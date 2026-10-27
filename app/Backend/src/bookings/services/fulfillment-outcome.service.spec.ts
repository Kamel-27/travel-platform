/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { RefundExecutionService } from './refund-execution.service';
import { TicketPdfService } from './ticket-pdf.service';
import { MailService } from '../../auth/services/mail.service';
import { LedgerService } from '../../ledger/services/ledger.service';
import { LedgerEntryType } from '../../ledger/entities/ledger-entry.entity';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';
import { Document } from '../entities/document.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { User } from '../../users/user.entity';
import {
  REFUND_EXECUTION_JOB,
  REFUND_EXECUTION_QUEUE,
} from '../queues/refund-execution.queue';

describe('FulfillmentOutcomeService', () => {
  let service: FulfillmentOutcomeService;
  let stateMachine: any;
  let ledgerService: any;
  let refundExecutionService: any;
  let queue: any;
  let mailService: any;
  let manager: any;
  let lockedBooking: Partial<Booking> | null;
  let payment: Partial<Payment> | null;
  let bookingRepo: any;

  const paidBooking: Partial<Booking> = {
    id: 'booking_001',
    userId: 'user_001',
    status: BookingStatus.Paid,
    supplier: Supplier.Duffel,
    baseAmount: 100000,
    markupAmount: 5000,
    totalAmount: 105000,
    currency: 'USD',
  };

  const order = {
    orderId: 'ord_001',
    bookingReference: 'PNR123',
    documents: [
      {
        type: 'electronic_ticket',
        uniqueIdentifier: '0761234567890',
        passengerIds: ['pas_001'],
      },
    ],
  };

  beforeEach(async () => {
    lockedBooking = { ...paidBooking };
    payment = {
      id: 'pay_001',
      bookingId: 'booking_001',
      status: PaymentStatus.Succeeded,
      amount: 105000,
      currency: 'USD',
    };

    const lockQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve(lockedBooking)),
    };
    bookingRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQuery),
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest
        .fn()
        .mockImplementation(() => Promise.resolve(lockedBooking)),
    };

    manager = {
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === Booking) return bookingRepo;
        if (cls === Payment) {
          return {
            findOneBy: jest
              .fn()
              .mockImplementation(() => Promise.resolve(payment)),
          };
        }
        if (cls === User) {
          return {
            findOneBy: jest
              .fn()
              .mockResolvedValue({ id: 'user_001', email: 'u@example.com' }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
          find: jest.fn().mockResolvedValue([]),
        };
      }),
      save: jest.fn().mockImplementation((_cls, val) => Promise.resolve(val)),
      transaction: jest.fn().mockImplementation((cb) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentOutcomeService,
        { provide: EntityManager, useValue: manager },
        {
          provide: BookingStateMachineService,
          useValue: { transitionTo: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: LedgerService,
          useValue: { createEntry: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RefundExecutionService,
          useValue: {
            createPendingRefund: jest
              .fn()
              .mockResolvedValue({ id: 'refund_001' }),
          },
        },
        {
          provide: TicketPdfService,
          useValue: { generate: jest.fn().mockResolvedValue(Buffer.from('')) },
        },
        {
          provide: MailService,
          useValue: { sendBookingConfirmation: jest.fn() },
        },
        {
          provide: getQueueToken(REFUND_EXECUTION_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(FulfillmentOutcomeService);
    stateMachine = module.get(BookingStateMachineService);
    ledgerService = module.get(LedgerService);
    refundExecutionService = module.get(RefundExecutionService);
    queue = module.get(getQueueToken(REFUND_EXECUTION_QUEUE));
    mailService = module.get(MailService);
  });

  describe('confirmPaidBooking (T5)', () => {
    it('confirms, records the supplier charge once, and stores documents', async () => {
      const applied = await service.confirmPaidBooking(
        manager,
        'booking_001',
        order,
        'webhook',
      );

      expect(applied).toBe(true);
      expect(bookingRepo.update).toHaveBeenCalledWith('booking_001', {
        supplierOrderId: 'ord_001',
        bookingReference: 'PNR123',
      });
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        manager,
        'booking_001',
        BookingStatus.Confirmed,
        null,
        'webhook',
      );
      expect(ledgerService.createEntry).toHaveBeenCalledTimes(1);
      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          entryType: LedgerEntryType.SupplierCharge,
          amount: -100000,
          currency: 'USD',
          bookingId: 'booking_001',
        }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        Document,
        expect.objectContaining({ uniqueIdentifier: '0761234567890' }),
      );
    });

    it('is a no-op once another path confirmed it — no duplicate charge or documents', async () => {
      lockedBooking = { ...paidBooking, status: BookingStatus.Confirmed };

      const applied = await service.confirmPaidBooking(
        manager,
        'booking_001',
        order,
        'webhook',
      );

      expect(applied).toBe(false);
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
      expect(ledgerService.createEntry).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('failPaidBookingAndRefund (T6)', () => {
    it('fails the booking, writes a pending refund, and enqueues it', async () => {
      const applied = await service.failPaidBookingAndRefund(
        'booking_001',
        'Duffel order rejected',
        'supplier_order_rejected',
      );

      expect(applied).toBe(true);
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        manager,
        'booking_001',
        BookingStatus.OrderFailed,
        null,
        'Duffel order rejected',
      );
      expect(refundExecutionService.createPendingRefund).toHaveBeenCalledWith(
        manager,
        {
          paymentId: 'pay_001',
          amount: 105000,
          reason: 'supplier_order_rejected',
          initiatedByUserId: null,
        },
      );
      expect(queue.add).toHaveBeenCalledWith(
        REFUND_EXECUTION_JOB,
        expect.objectContaining({ refundId: 'refund_001' }),
        expect.objectContaining({ jobId: 'refund:refund_001' }),
      );
    });

    it('is a no-op when the booking already left paid', async () => {
      lockedBooking = { ...paidBooking, status: BookingStatus.Confirmed };

      const applied = await service.failPaidBookingAndRefund(
        'booking_001',
        'x',
        'y',
      );

      expect(applied).toBe(false);
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
      expect(refundExecutionService.createPendingRefund).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('still fails the booking when the payment is not refundable, leaving the refund to an admin', async () => {
      payment = { ...payment, status: PaymentStatus.Pending };

      const applied = await service.failPaidBookingAndRefund(
        'booking_001',
        'x',
        'y',
      );

      expect(applied).toBe(true);
      expect(stateMachine.transitionTo).toHaveBeenCalled();
      expect(refundExecutionService.createPendingRefund).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('keeps the order_failed transition when the refund row is rejected', async () => {
      refundExecutionService.createPendingRefund.mockRejectedValue(
        new UnprocessableEntityException('exceeds remaining'),
      );

      await expect(
        service.failPaidBookingAndRefund('booking_001', 'x', 'y'),
      ).resolves.toBe(true);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('does not throw when Redis is down — the requeue sweep recovers', async () => {
      queue.add.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.failPaidBookingAndRefund('booking_001', 'x', 'y'),
      ).resolves.toBe(true);
    });
  });

  describe('sendConfirmationEmail', () => {
    it('emails the rendered ticket to the account holder', async () => {
      await service.sendConfirmationEmail('booking_001');

      expect(mailService.sendBookingConfirmation).toHaveBeenCalledWith(
        'u@example.com',
        expect.objectContaining({ id: 'booking_001' }),
        expect.any(Buffer),
      );
    });

    it('swallows mail transport errors', async () => {
      mailService.sendBookingConfirmation.mockRejectedValue(
        new Error('Resend down'),
      );

      await expect(
        service.sendConfirmationEmail('booking_001'),
      ).resolves.toBeUndefined();
    });
  });
});
