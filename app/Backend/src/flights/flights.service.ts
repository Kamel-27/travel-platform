import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { DuffelService } from '../duffel/duffel.service';
import type { NormalizedOffer } from '../duffel/duffel.service';
import { ErrorCode } from '../common/dto/error-response.dto';
import type { FlightSearchQueryDto } from './dto/flight-search-query.dto';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  // Outbound rate limits to Duffel
  private readonly outboundBucketKey = 'duffel_rate_limit:search';
  private readonly outboundBucketCapacity = 100; // safe margin below 120
  private readonly outboundRefillRatePerMs = 120 / (60 * 1000); // 120 tokens per 60000ms

  // Inbound rate limits (per-IP sliding window)
  private readonly inboundSearchLimit = 30; // 30 req/min/IP per nfr.md §3

  constructor(
    private readonly duffelService: DuffelService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Searches flights with:
   * 1. Per-IP inbound sliding window rate limit
   * 2. Cache check (Redis)
   * 3. Outbound token bucket rate limit check (Redis)
   * 4. Supplier execution + normalization
   * 5. Dynamic caching with TTL = min(2 min, offer expiry)
   */
  async search(
    query: FlightSearchQueryDto,
    ip: string | null,
  ): Promise<NormalizedOffer[]> {
    // 1. Inbound IP rate limiting
    if (ip) {
      await this.checkInboundRateLimit(ip);
    }

    // 2. Cache lookup
    const cacheKey = this.buildCacheKey(query);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug(`Search cache hit for key: ${cacheKey}`);
      try {
        return JSON.parse(cached) as NormalizedOffer[];
      } catch {
        this.logger.error(
          `Failed to parse cached search results for: ${cacheKey}`,
        );
      }
    }

    // 3. Outbound rate limit check (token bucket)
    await this.checkOutboundRateLimit();

    // Prepare passenger request payload
    const passengers: { type: string }[] = [];
    for (let i = 0; i < query.adults; i++) passengers.push({ type: 'adult' });
    for (let i = 0; i < query.children; i++) passengers.push({ type: 'child' });
    for (let i = 0; i < query.infants; i++) passengers.push({ type: 'infant' });

    // 4. Call Duffel supplier
    const offers = await this.duffelService.search({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departure_date,
      returnDate: query.return_date,
      passengers,
      cabinClass: query.cabin_class,
    });

    // 5. Compute dynamic TTL and cache
    if (offers.length > 0) {
      const ttlSeconds = this.calculateCacheTtl(offers);
      if (ttlSeconds > 0) {
        await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(offers));
        this.logger.debug(
          `Cached search results for ${ttlSeconds}s under: ${cacheKey}`,
        );
      }
    }

    return offers;
  }

  /**
   * Revalidates an offer against Duffel (fresh expires_at, price re-check).
   */
  async fetchOffer(offerId: string): Promise<NormalizedOffer> {
    return this.duffelService.fetchOffer(offerId);
  }

  // ── Rate Limiters & Cache Helpers ─────────────────────────────────

  private async checkInboundRateLimit(ip: string): Promise<void> {
    const ipKey = `rate_limit:flights_search:ip:${ip}`;
    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1 minute window

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(ipKey, 0, windowStart);
    pipeline.zadd(ipKey, now, now.toString());
    pipeline.zcard(ipKey);
    pipeline.expire(ipKey, 65);

    const results = await pipeline.exec();
    if (!results) {
      return;
    }

    const zcardResult = results[2];
    if (zcardResult && zcardResult[1] !== undefined) {
      const count = zcardResult[1] as number;
      if (count > this.inboundSearchLimit) {
        throw new HttpException(
          {
            code: ErrorCode.RATE_LIMITED,
            message:
              'Too many search requests. Please wait a minute before searching again.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private async checkOutboundRateLimit(): Promise<void> {
    const data = await this.redis.hmget(
      this.outboundBucketKey,
      'tokens',
      'last_refill',
    );
    const now = Date.now();

    let tokens = data[0] ? parseFloat(data[0]) : this.outboundBucketCapacity;
    const lastRefill = data[1] ? parseInt(data[1], 10) : now;

    // Refill tokens
    const deltaMs = now - lastRefill;
    tokens = Math.min(
      this.outboundBucketCapacity,
      tokens + deltaMs * this.outboundRefillRatePerMs,
    );

    // Rate-limited
    if (tokens < 1) {
      this.logger.warn('Duffel outbound rate limit token bucket exhausted.');
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMITED,
          message:
            'Flight search service is currently busy. Please try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Consume 1 token
    tokens -= 1;
    await this.redis.hset(
      this.outboundBucketKey,
      'tokens',
      tokens.toString(),
      'last_refill',
      now.toString(),
    );
  }

  private buildCacheKey(query: FlightSearchQueryDto): string {
    const parts = [
      query.origin.toUpperCase(),
      query.destination.toUpperCase(),
      query.departure_date,
      query.return_date ?? 'oneway',
      query.cabin_class ?? 'any',
      query.adults.toString(),
      query.children.toString(),
      query.infants.toString(),
    ];
    return `flight_search:cache:${parts.join(':')}`;
  }

  private calculateCacheTtl(offers: NormalizedOffer[]): number {
    const now = Date.now();
    let minTimeRemainingMs = 2 * 60 * 1000; // default 2 minutes (120s)

    for (const offer of offers) {
      if (offer.expires_at) {
        const expiry = Date.parse(offer.expires_at);
        if (!isNaN(expiry)) {
          const remaining = expiry - now;
          if (remaining < minTimeRemainingMs) {
            minTimeRemainingMs = remaining;
          }
        }
      }
    }

    // Convert to seconds, ensure it is positive and capped at 120s
    const ttlSeconds = Math.max(0, Math.floor(minTimeRemainingMs / 1000));
    return Math.min(120, ttlSeconds);
  }
}
