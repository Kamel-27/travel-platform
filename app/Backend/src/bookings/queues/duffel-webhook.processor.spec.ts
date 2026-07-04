/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { DuffelWebhookProcessor } from './duffel-webhook.processor';
import { DuffelService } from '../../duffel/duffel.service';
import { DuffelReconciliationService } from '../services/duffel-reconciliation.service';
import { MailService } from '../../auth/services/mail.service';
import { SupplierWebhookEvent } from '../entities/supplier-webhook-event.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Segment } from '../entities/segment.entity';
import { User } from '../../users/user.entity';

describe('DuffelWebhookProcessor', () => {
  let processor: DuffelWebhookProcessor;
  let duffelService: DuffelService;
  let reconciliation: DuffelReconciliationService;
  let mailService: MailService;
  let mockEntityManager: any;
  let mockEventQueryBuilder: any;

  let mockBookingRepo: any;
  let mockSnapshotRepo: any;
  let mockSegmentRepo: any;
  let mockUserRepo: any;

  const paidBooking = {
    id: 'booking_1',
    userId: 'user_1',
    status: BookingStatus.Paid,
    supplierOrderId: null,
    bookingReference: null,
  };

  function makeEvent(overrides: Partial<SupplierWebhookEvent> = {}) {
    return {
      id: 'evt_1',
      supplier: 'duffel',
      supplierEventId: 'wev_1',
      supplierResourceId: 'ord_1',
      eventType: 'order.created',
      payload: {},
      bookingId: null,
      processedAt: null,
      ...overrides,
    } as SupplierWebhookEvent;
  }

  beforeEach(async () => {
    mockBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockSnapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockSegmentRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'user_1', email: 'a@b.com' }),
    };

    mockEventQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(makeEvent()),
    };

    mockEntityManager = {
      save: jest.fn().mockImplementation((cls, val) => Promise.resolve(val)),
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === SupplierWebhookEvent) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(mockEventQueryBuilder),
          };
        }
        if (cls === Booking) return mockBookingRepo;
        if (cls === FlightOfferSnapshot) return mockSnapshotRepo;
        if (cls === Segment) return mockSegmentRepo;
        if (cls === User) return mockUserRepo;
        return {};
      }),
    };
    mockEntityManager.transaction = jest
      .fn()
      .mockImplementation((cb) => cb(mockEntityManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuffelWebhookProcessor,
        {
          provide: DuffelService,
          useValue: {
            getOrder: jest
              .fn()
              .mockResolvedValue({ id: 'ord_1', metadata: {} }),
          },
        },
        {
          provide: DuffelReconciliationService,
          useValue: {
            confirmBookingFromOrder: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MailService,
          useValue: { sendScheduleChangeEmail: jest.fn() },
        },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    processor = module.get(DuffelWebhookProcessor);
    duffelService = module.get(DuffelService);
    reconciliation = module.get(DuffelReconciliationService);
    mailService = module.get(MailService);
  });

  it('skips an already-processed event', async () => {
    mockEventQueryBuilder.getOne.mockResolvedValue(
      makeEvent({ processedAt: new Date() }),
    );

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(mockBookingRepo.findOneBy).not.toHaveBeenCalled();
    expect(mockEntityManager.save).not.toHaveBeenCalled();
  });

  it('order.created: confirms booking via direct supplierOrderId match (fast path)', async () => {
    mockBookingRepo.findOneBy.mockResolvedValue({ ...paidBooking });

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(mockBookingRepo.findOneBy).toHaveBeenCalledWith({
      supplierOrderId: 'ord_1',
    });
    expect(reconciliation.confirmBookingFromOrder).toHaveBeenCalledWith(
      mockEntityManager,
      expect.objectContaining({ id: 'booking_1' }),
      expect.objectContaining({ id: 'ord_1' }),
    );
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      SupplierWebhookEvent,
      expect.objectContaining({
        bookingId: 'booking_1',
        processedAt: expect.any(Date),
      }),
    );
  });

  it('order.created: falls back to matching via order metadata idempotency key', async () => {
    mockBookingRepo.findOneBy
      .mockResolvedValueOnce(null) // direct supplierOrderId lookup misses
      .mockResolvedValueOnce({ ...paidBooking }); // supplierIdempotencyKey lookup hits
    (duffelService.getOrder as jest.Mock).mockResolvedValue({
      id: 'ord_1',
      metadata: { idempotency_key: 'idemp_abc' },
    });

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(mockBookingRepo.findOneBy).toHaveBeenNthCalledWith(2, {
      supplierIdempotencyKey: 'idemp_abc',
    });
    expect(reconciliation.confirmBookingFromOrder).toHaveBeenCalled();
  });

  it('order.created: leaves the event unprocessed when the booking cannot be resolved', async () => {
    mockBookingRepo.findOneBy.mockResolvedValue(null);
    (duffelService.getOrder as jest.Mock).mockResolvedValue({
      id: 'ord_1',
      metadata: {},
    });

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(reconciliation.confirmBookingFromOrder).not.toHaveBeenCalled();
    expect(mockEntityManager.save).not.toHaveBeenCalledWith(
      SupplierWebhookEvent,
      expect.objectContaining({ processedAt: expect.any(Date) }),
    );
  });

  it('ping.triggered: marks processed with no booking link', async () => {
    mockEventQueryBuilder.getOne.mockResolvedValue(
      makeEvent({ eventType: 'ping.triggered', supplierResourceId: null }),
    );

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(mockEntityManager.save).toHaveBeenCalledWith(
      SupplierWebhookEvent,
      expect.objectContaining({
        bookingId: null,
        processedAt: expect.any(Date),
      }),
    );
  });

  it('order.airline_initiated_change_detected: updates segments, flags booking, and emails the user', async () => {
    mockEventQueryBuilder.getOne.mockResolvedValue(
      makeEvent({ eventType: 'order.airline_initiated_change_detected' }),
    );
    mockBookingRepo.findOneBy.mockResolvedValue({ ...paidBooking });

    const storedSegment = {
      id: 'seg_1',
      flightNumber: 'MS651',
      departingAtLocal: new Date('2026-08-01T09:15:00'),
      arrivingAtLocal: new Date('2026-08-01T12:40:00'),
      originTimezone: 'Africa/Cairo',
      destinationTimezone: 'Asia/Riyadh',
    };
    mockSnapshotRepo.findOne.mockResolvedValue({
      bookingId: 'booking_1',
      slices: [{ segments: [storedSegment] }],
    });
    (duffelService.getOrder as jest.Mock).mockResolvedValue({
      id: 'ord_1',
      slices: [
        {
          segments: [
            {
              departing_at: '2026-08-01T11:15:00',
              arriving_at: '2026-08-01T14:40:00',
              origin: { time_zone: 'Africa/Cairo' },
              destination: { time_zone: 'Asia/Riyadh' },
            },
          ],
        },
      ],
    });

    await processor.process({ data: { eventId: 'evt_1' } } as any);

    expect(mockSegmentRepo.update).toHaveBeenCalledWith(
      'seg_1',
      expect.objectContaining({
        departingAtLocal: new Date('2026-08-01T11:15:00'),
      }),
    );
    expect(mockBookingRepo.update).toHaveBeenCalledWith('booking_1', {
      scheduleChangeDetectedAt: expect.any(Date),
    });
    expect(mailService.sendScheduleChangeEmail).toHaveBeenCalledWith(
      'a@b.com',
      'booking_1',
      null,
      expect.arrayContaining([
        expect.objectContaining({ flightNumber: 'MS651' }),
      ]),
    );
  });
});
