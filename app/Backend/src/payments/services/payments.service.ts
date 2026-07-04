import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { PaymobService } from './paymob.service';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { FlightOfferSnapshot } from '../../bookings/entities/flight-offer-snapshot.entity';
import {
  Passenger,
  PassengerType,
} from '../../bookings/entities/passenger.entity';
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
import type { JwtPayload } from '../../auth/guards/jwt-auth.guard';

interface CreateAttemptResult {
  provider: string;
  payment_token: string;
  iframe_url: string | null;
  amount: number;
  currency: string;
}

type CreateAttemptOutcome =
  { expired: true } | { expired: false; payload: CreateAttemptResult };

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
    private readonly paymobService: PaymobService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Creates or retries a payment attempt for a booking by registering a
   * Paymob order and requesting a payment key (iframe token).
   * Enforces rules around booking statuses and offer expiration dates.
   */
  async createOrGetPaymentAttempt(
    user: JwtPayload,
    bookingId: string,
  ): Promise<CreateAttemptResult> {
    const outcome = await this.entityManager.transaction<CreateAttemptOutcome>(
      async (manager) => {
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

        if (booking.userId !== user.sub) {
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
          // T3: mark failed, then commit — throwing inside this transaction
          // would roll the transition back, so the 409 is raised outside.
          await this.stateMachine.transitionTo(
            manager,
            booking.id,
            BookingStatus.Failed,
            user.sub,
            'offer_expired',
          );
          return { expired: true };
        }

        // 3. Resolve or create Payment record
        let payment = await manager
          .getRepository(Payment)
          .findOneBy({ bookingId: booking.id });
        if (!payment) {
          payment = new Payment();
          payment.bookingId = booking.id;
          payment.provider = PaymentProvider.Paymob;
          payment.status = PaymentStatus.Pending;
          payment.amount = booking.totalAmount;
          payment.currency = booking.currency;
          payment = await manager.save(Payment, payment);
        }

        // 4. Register Paymob order + payment key.
        // Paymob requires billing data; the lead adult passenger carries the
        // contact fields T2 already validated. The account's own name/email
        // are only a defensive fallback, so look them up here rather than
        // widen the JwtPayload the guard hands us.
        const accountUser = await manager
          .getRepository(User)
          .findOneBy({ id: user.sub });
        const billing = await this.resolveBillingData(
          manager,
          booking.id,
          accountUser,
        );

        // merchant_order_id must be unique per Paymob order, so retries
        // (new attempts) get a fresh suffix while staying traceable.
        const merchantOrderId = `${booking.id}:${randomUUID().slice(0, 8)}`;

        const paymentKey = await this.paymobService.createPaymentKey(
          booking.totalAmount,
          booking.currency,
          merchantOrderId,
          billing,
        );

        // 5. Create new PaymentAttempt record keyed by the Paymob order id —
        // that is what transaction webhooks carry (obj.order.id).
        const attempt = new PaymentAttempt();
        attempt.paymentId = payment.id;
        attempt.providerReferenceId = paymentKey.orderId;
        attempt.status = PaymentAttemptStatus.RequiresAction;
        attempt.method = 'card'; // default method

        await manager.save(PaymentAttempt, attempt);

        return {
          expired: false,
          payload: {
            provider: 'paymob',
            payment_token: paymentKey.paymentKey,
            iframe_url: paymentKey.iframeUrl,
            amount: payment.amount,
            currency: payment.currency,
          },
        };
      },
    );

    if (outcome.expired) {
      throw new ConflictException({
        code: ErrorCode.OFFER_EXPIRED,
        message: 'The flight offer has expired.',
      });
    }

    return outcome.payload;
  }

  /**
   * Retrieves payment rollup summary (Payment, PaymentAttempts, Refunds).
   */
  async getPaymentRollup(user: JwtPayload, bookingId: string): Promise<any> {
    const booking = await this.entityManager
      .getRepository(Booking)
      .findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    if (booking.userId !== user.sub && user.role !== UserRole.TechnicalAdmin) {
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

  private async resolveBillingData(
    manager: EntityManager,
    bookingId: string,
    user: User | null,
  ): Promise<{
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  }> {
    const passengers = await manager
      .getRepository(Passenger)
      .find({ where: { bookingId } });

    const lead =
      passengers.find((p) => p.type === PassengerType.Adult) ?? passengers[0];

    return {
      first_name: lead?.givenName || user?.fullName || 'NA',
      last_name: lead?.familyName || 'NA',
      email: lead?.email || user?.email || 'NA',
      phone_number: lead?.phoneNumber || 'NA',
    };
  }
}
