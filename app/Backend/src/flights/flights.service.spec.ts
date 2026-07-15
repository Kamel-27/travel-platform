/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { DuffelService } from '../duffel/duffel.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { CabinClass } from './dto/flight-search-query.dto';
import { ErrorCode } from '../common/dto/error-response.dto';

describe('FlightsService', () => {
  let service: FlightsService;
  let duffelService: DuffelService;
  let mockRedis: any;

  const mockQuery = {
    origin: 'CAI',
    destination: 'RUH',
    departure_date: '2026-08-01',
    adults: 1,
    children: 0,
    infants: 0,
    cabin_class: CabinClass.Economy,
  };

  const mockOffers = [
    {
      offer_id: 'off_1',
      expires_at: new Date(Date.now() + 60000).toISOString(), // 60s remaining
      total: { amount: 10000, currency: 'USD' },
      airline: { name: 'Saudi', iata: 'SV', logo_url: '' },
      cabin_class: 'economy',
      passenger_identity_documents_required: false,
      slices: [],
      conditions: {},
    },
  ];

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      hset: jest.fn().mockResolvedValue(1),
      hmget: jest.fn().mockResolvedValue(['100', Date.now().toString()]), // token bucket details
      pipeline: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 1],
        ]), // IP limit checks
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsService,
        {
          provide: DuffelService,
          useValue: {
            search: jest.fn().mockResolvedValue(mockOffers),
            fetchOffer: jest.fn().mockResolvedValue(mockOffers[0]),
            searchAirports: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<FlightsService>(FlightsService);
    duffelService = module.get<DuffelService>(DuffelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return cached result if hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockOffers));

      const result = await service.search(mockQuery, '127.0.0.1');

      expect(mockRedis.get).toHaveBeenCalled();
      expect(duffelService.search).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].offer_id).toBe('off_1');
    });

    it('should call Duffel on cache miss and save with dynamic TTL', async () => {
      const result = await service.search(mockQuery, '127.0.0.1');

      expect(mockRedis.get).toHaveBeenCalled();
      expect(duffelService.search).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('flight_search:cache:'),
        expect.any(Number),
        JSON.stringify(mockOffers),
      );
      expect(result).toHaveLength(1);

      // Check TTL is dynamic and less than/equal to 60s
      const ttl = mockRedis.setex.mock.calls[0][1];
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should enforce IP rate limits (inbound sliding window)', async () => {
      // Simulate count > 30 inside sliding window
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 35],
        ]), // 35 requests
      });

      await expect(service.search(mockQuery, '1.2.3.4')).rejects.toThrow(
        HttpException,
      );

      try {
        await service.search(mockQuery, '1.2.3.4');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().code).toBe(ErrorCode.RATE_LIMITED);
      }
    });

    it('should enforce outbound rate limits (token bucket)', async () => {
      // Outbound rate limit exhausted (0 tokens)
      mockRedis.hmget.mockResolvedValue(['0', Date.now().toString()]);

      await expect(service.search(mockQuery, '127.0.0.1')).rejects.toThrow(
        HttpException,
      );

      try {
        await service.search(mockQuery, '127.0.0.1');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().code).toBe(ErrorCode.RATE_LIMITED);
      }
    });
  });

  describe('searchAirports', () => {
    it('should delegate search to DuffelService', async () => {
      const mockSuggestions = [
        {
          code: 'LHR',
          city: 'London',
          country: 'United Kingdom',
          type: 'airport',
          name: 'Heathrow',
        },
      ];
      (duffelService.searchAirports as jest.Mock).mockResolvedValue(
        mockSuggestions,
      );

      const result = await service.searchAirports('london');

      expect(duffelService.searchAirports).toHaveBeenCalledWith('london');
      expect(result).toEqual(mockSuggestions);
    });
  });
});
