import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { StripeService } from './stripe.service';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { FlightOfferSnapshot } from '../../bookings/entities/flight-offer-snapshot.entity';
import {
  Payment,
  PaymentProvider,
  PaymentStatus,
} from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { Refund } from '../entities/refund.entity';
import { User, UserRole } from '../../users/user.entity';
import { ErrorCode } from '../../common/dto/error-response.dto';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAttempt)
    private readonly attemptRepo: Repository<PaymentAttempt>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    private readonly stripeService: StripeService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Creates or retries a payment attempt for a booking by initializing a Stripe PaymentIntent.
   * Enforces rules around booking statuses and offer expiration dates.
   */
  async createOrGetPaymentAttempt(
    user: User,
    bookingId: string,
  ): Promise<{
    provider: string;
    client_secret: string | null;
    amount: number;
    currency: string;
  }> {
    return this.entityManager.transaction(async (manager) => {
      // 1. Lock and retrieve Booking
      const booking = await manager
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: bookingId })
        .getOne();

      if (!booking) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Booking not found.',
        });
      }

      if (booking.userId !== user.id) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Access denied to this booking.',
        });
      }

      // Check booking status guard
      if (booking.status !== BookingStatus.AwaitingPayment) {
        throw new ConflictException({
          code: ErrorCode.ILLEGAL_TRANSITION,
          message: `Booking must be in awaiting_payment status, current status is ${booking.status}.`,
        });
      }

      // 2. Load and verify offer snapshot expiry
      const snapshot = await manager
        .getRepository(FlightOfferSnapshot)
        .findOneBy({ bookingId: booking.id });

      if (!snapshot) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Booking snapshot not found.',
        });
      }

      const now = new Date();
      if (new Date(snapshot.expiresAt) <= now) {
        // T3: Transition booking status to failed
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Failed,
          user.id,
          'offer_expired',
        );
        throw new ConflictException({
          code: ErrorCode.OFFER_EXPIRED,
          message: 'The flight offer has expired.',
        });
      }

      // 3. Resolve or create Payment record
      let payment = await manager
        .getRepository(Payment)
        .findOneBy({ bookingId: booking.id });
      if (!payment) {
        payment = new Payment();
        payment.bookingId = booking.id;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Pending;
        payment.amount = booking.totalAmount;
        payment.currency = booking.currency;
        payment = await manager.save(Payment, payment);
      }

      // 4. Create Stripe PaymentIntent
      const intent = await this.stripeService.createPaymentIntent(
        booking.totalAmount,
        booking.currency,
        booking.id,
      );

      // 5. Create new PaymentAttempt record
      const attempt = new PaymentAttempt();
      attempt.paymentId = payment.id;
      attempt.providerReferenceId = intent.id;
      attempt.status = this.mapStripeStatusToAttemptStatus(intent.status);
      attempt.method = 'card'; // default method

      await manager.save(PaymentAttempt, attempt);

      return {
        provider: 'stripe',
        client_secret: intent.client_secret,
        amount: payment.amount,
        currency: payment.currency,
      };
    });
  }

  /**
   * Retrieves payment rollup summary (Payment, PaymentAttempts, Refunds).
   */
  async getPaymentRollup(user: User, bookingId: string): Promise<any> {
    const booking = await this.entityManager
      .getRepository(Booking)
      .findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    if (booking.userId !== user.id && user.role !== UserRole.TechnicalAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied to this booking payment details.',
      });
    }

    const payment = await this.paymentRepo.findOneBy({ bookingId });
    if (!payment) {
      return null;
    }

    const attempts = await this.attemptRepo.find({
      where: { paymentId: payment.id },
      order: { attemptedAt: 'DESC' },
    });

    const refunds = await this.refundRepo.find({
      where: { paymentId: payment.id },
      order: { createdAt: 'DESC' },
    });

    return {
      payment_id: payment.id,
      status: payment.status,
      provider: payment.provider,
      amount: payment.amount,
      currency: payment.currency,
      attempts: attempts.map((a) => ({
        id: a.id,
        provider_reference_id: a.providerReferenceId,
        status: a.status,
        failure_reason: a.failureReason,
        method: a.method,
        attempted_at: a.attemptedAt,
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        provider_refund_id: r.providerRefundId,
        amount: r.amount,
        currency: r.currency,
        supplier_refund_amount: r.supplierRefundAmount,
        status: r.status,
        reason: r.reason,
        created_at: r.createdAt,
      })),
    };
  }

  private mapStripeStatusToAttemptStatus(
    stripeStatus: string,
  ): PaymentAttemptStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return PaymentAttemptStatus.Succeeded;
      case 'processing':
        return PaymentAttemptStatus.Processing;
      case 'requires_action':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_capture':
        return PaymentAttemptStatus.RequiresAction;
      case 'canceled':
      default:
        return PaymentAttemptStatus.Failed;
    }
  }
}
