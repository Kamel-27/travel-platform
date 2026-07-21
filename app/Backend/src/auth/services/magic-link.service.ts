import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { ErrorCode } from '../../common/dto/error-response.dto';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { User } from '../../users/user.entity';
import { MagicLinkToken } from '../entities/magic-link-token.entity';
import { AuthProvider } from '../entities/auth-identity.entity';
import { AccountResolutionService } from './account-resolution.service';
import { MailService } from './mail.service';

/** 15 minutes in seconds */
const MAGIC_LINK_TTL_SECONDS = 15 * 60;

/** Max requests per email in a 15-min window */
const MAX_PER_EMAIL = 3;
/** Max requests per IP in a 15-min window */
const MAX_PER_IP = 10;
/** Sliding window size in seconds */
const RATE_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);

  constructor(
    @InjectRepository(MagicLinkToken)
    private readonly magicLinkRepo: Repository<MagicLinkToken>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly accountResolution: AccountResolutionService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Request a magic link.
   *
   * Always succeeds (202) — no account enumeration.
   * Rate-limited per email and per IP; if limited, the email is
   * silently not sent but the response is identical.
   */
  async request(email: string, ip: string | null): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate-limit check (silent — never reveals rate-limit to the user)
    const withinLimits = await this.checkRateLimits(normalizedEmail, ip);
    if (!withinLimits) {
      this.logger.debug(
        `Rate limit reached for magic-link request: ${normalizedEmail}`,
      );
      return; // Silent 202 — no email sent
    }

    // Generate token: 256-bit random → base64url
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + MAGIC_LINK_TTL_SECONDS);

    // Store the hash (never the raw token) — auth_flow.md §3
    const magicLink = this.magicLinkRepo.create({
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      requestedIp: ip,
    });
    await this.magicLinkRepo.save(magicLink);

    // Increment rate-limit counters
    await this.incrementRateLimits(normalizedEmail, ip);

    // Send the magic link (dev: log to console; prod: real email transport).
    // sendMagicLink never throws — a transport failure is logged internally,
    // preserving the always-202 (no account enumeration) contract.
    await this.mailService.sendMagicLink(normalizedEmail, rawToken);
  }

  /**
   * Verify a magic link token.
   *
   * On success: marks the token as used (atomic), invalidates all other
   * outstanding tokens for the same email, and resolves the account.
   *
   * On failure: uniform 401 TOKEN_INVALID for expired/used/unknown.
   */
  async verify(rawToken: string): Promise<User> {
    const tokenHash = this.hashToken(rawToken);

    // Lookup by hash (indexed — hot path)
    const token = await this.magicLinkRepo.findOne({
      where: { tokenHash },
    });

    // Unknown token
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Magic link is invalid or has expired',
      });
    }

    // Expired
    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Magic link is invalid or has expired',
      });
    }

    // Already used
    if (token.usedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Magic link is invalid or has expired',
      });
    }

    // Atomic single-use: UPDATE … WHERE used_at IS NULL
    // If another request beat us, affected = 0
    const result = await this.magicLinkRepo
      .createQueryBuilder()
      .update(MagicLinkToken)
      .set({ usedAt: new Date() })
      .where('id = :id AND used_at IS NULL', { id: token.id })
      .execute();

    if (!result.affected || result.affected === 0) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Magic link is invalid or has expired',
      });
    }

    // Invalidate all other outstanding tokens for this email
    await this.magicLinkRepo
      .createQueryBuilder()
      .update(MagicLinkToken)
      .set({ usedAt: new Date() })
      .where('email = :email AND used_at IS NULL AND id != :id', {
        email: token.email,
        id: token.id,
      })
      .execute();

    // Resolve the account (find-or-create user + identity)
    const user = await this.accountResolution.resolve(
      token.email,
      AuthProvider.EmailLink,
      null,
    );

    return user;
  }

  // ─── Rate Limiting (Redis sliding window) ─────────────────────────

  private async checkRateLimits(
    email: string,
    ip: string | null,
  ): Promise<boolean> {
    const emailKey = `magic_link:email:${email}`;
    const emailCount = await this.redis.get(emailKey);
    if (emailCount && parseInt(emailCount, 10) >= MAX_PER_EMAIL) {
      return false;
    }

    if (ip) {
      const ipKey = `magic_link:ip:${ip}`;
      const ipCount = await this.redis.get(ipKey);
      if (ipCount && parseInt(ipCount, 10) >= MAX_PER_IP) {
        return false;
      }
    }

    return true;
  }

  private async incrementRateLimits(
    email: string,
    ip: string | null,
  ): Promise<void> {
    const emailKey = `magic_link:email:${email}`;
    const pipeline = this.redis.pipeline();
    pipeline.incr(emailKey);
    pipeline.expire(emailKey, RATE_WINDOW_SECONDS);

    if (ip) {
      const ipKey = `magic_link:ip:${ip}`;
      pipeline.incr(ipKey);
      pipeline.expire(ipKey, RATE_WINDOW_SECONDS);
    }

    await pipeline.exec();
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
