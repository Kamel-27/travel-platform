/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { DuffelService } from './duffel.service';
import { ErrorCode } from '../common/dto/error-response.dto';

const duffelOfferFixture = {
  id: 'off_0000AUd7VfJtL0S4Lq7xLq',
  expires_at: '2026-07-04T18:21:00Z',
  total_amount: '1542.00',
  total_currency: 'USD',
  owner: {
    name: 'EgyptAir',
    iata_code: 'MS',
    logo_symbol_url: 'https://assets.duffel.com/img/airlines/MS.png',
  },
  cabin_class: 'economy',
  passenger_identity_documents_required: false,
  slices: [
    {
      origin: { iata_code: 'CAI', time_zone: 'Africa/Cairo' },
      destination: { iata_code: 'RUH', time_zone: 'Asia/Riyadh' },
      duration: 'PT3H25M',
      segments: [
        {
          marketing_carrier: { iata_code: 'MS' },
          operating_carrier: { iata_code: 'MS' },
          marketing_carrier_flight_number: '651',
          departing_at: '2026-08-01T09:15:00',
          arriving_at: '2026-08-01T12:40:00',
          origin: { iata_code: 'CAI', time_zone: 'Africa/Cairo' },
          origin_terminal: '3',
          destination: { iata_code: 'RUH', time_zone: 'Asia/Riyadh' },
          destination_terminal: null,
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: {
      allowed: true,
      penalty_amount: '300.00',
      penalty_currency: 'USD',
    },
  },
};

describe('DuffelService', () => {
  let service: DuffelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuffelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DUFFEL_API_KEY') return 'mock-duffel-api-key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DuffelService>(DuffelService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mapping logic', () => {
    it('should map a raw Duffel search response offer to the contract shape', () => {
      const normalized = (service as any).mapOffer(duffelOfferFixture);

      expect(normalized.offer_id).toBe('off_0000AUd7VfJtL0S4Lq7xLq');
      expect(normalized.expires_at).toBe('2026-07-04T18:21:00Z');

      // Amount should be in minor units: $1,542.00 -> 154200
      expect(normalized.total.amount).toBe(154200);
      expect(normalized.total.currency).toBe('USD');

      expect(normalized.airline.name).toBe('EgyptAir');
      expect(normalized.airline.iata).toBe('MS');
      expect(normalized.airline.logo_url).toBe(
        'https://assets.duffel.com/img/airlines/MS.png',
      );

      expect(normalized.cabin_class).toBe('economy');
      expect(normalized.passenger_identity_documents_required).toBe(false);

      // Slice checks
      expect(normalized.slices).toHaveLength(1);
      const slice = normalized.slices[0];
      expect(slice.origin).toBe('CAI');
      expect(slice.destination).toBe('RUH');
      expect(slice.duration).toBe('PT3H25M');

      // Segment checks
      expect(slice.segments).toHaveLength(1);
      const seg = slice.segments[0];
      expect(seg.marketing_carrier).toBe('MS');
      expect(seg.operating_carrier).toBe('MS');
      expect(seg.flight_number).toBe('651');
      expect(seg.departing_at.local).toBe('2026-08-01T09:15:00');
      expect(seg.departing_at.timezone).toBe('Africa/Cairo');
      expect(seg.arriving_at.local).toBe('2026-08-01T12:40:00');
      expect(seg.arriving_at.timezone).toBe('Asia/Riyadh');
      expect(seg.origin_terminal).toBe('3');
      expect(seg.destination_terminal).toBeNull();

      // Condition penalty conversion checks: $300.00 -> 30000 minor units
      expect(normalized.conditions.refund_before_departure.allowed).toBe(true);
      expect(normalized.conditions.refund_before_departure.penalty.amount).toBe(
        30000,
      );
      expect(
        normalized.conditions.refund_before_departure.penalty.currency,
      ).toBe('USD');
    });

    it('should map different currency minor unit decimals correctly', () => {
      const kuwaitiDinarOffer = {
        ...duffelOfferFixture,
        total_amount: '12.345',
        total_currency: 'KWD',
      };

      const normalizedKwd = (service as any).mapOffer(kuwaitiDinarOffer);
      expect(normalizedKwd.total.amount).toBe(12345); // KWD has 3 decimal places

      const japaneseYenOffer = {
        ...duffelOfferFixture,
        total_amount: '12500',
        total_currency: 'JPY',
      };

      const normalizedJpy = (service as any).mapOffer(japaneseYenOffer);
      expect(normalizedJpy.total.amount).toBe(12500); // JPY has 0 decimal places
    });
  });

  describe('outbound requests', () => {
    it('should throw ServiceUnavailableException if API key is missing', async () => {
      // Mock missing key
      const unconfiguredService = new DuffelService({
        get: jest.fn().mockReturnValue(undefined),
      } as any);

      await expect(
        unconfiguredService.search({
          origin: 'CAI',
          destination: 'RUH',
          departureDate: '2026-08-01',
          passengers: [{ type: 'adult' }],
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw expired offer exception on 410 Gone status', async () => {
      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      await expect(service.fetchOffer('expired-offer-id')).rejects.toThrow(
        HttpException,
      );

      try {
        await service.fetchOffer('expired-offer-id');
      } catch (err: any) {
        expect(err.getStatus()).toBe(410);
        expect(err.getResponse().code).toBe(ErrorCode.OFFER_EXPIRED);
      }
    });
  });
});
