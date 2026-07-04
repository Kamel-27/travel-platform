import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { PaymobService } from '../../payments/services/paymob.service';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';
import { PaymentWebhookEvent } from '../../payments/entities/payment-webhook-event.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { BookingStateMachineService } from './booking-state-machine.service';
import { ErrorCode } from '../../common/dto/error-response.dto';

interface RecordRefundParams {
  paymentId: string;
  refundId: string;
  amount: number;
  reason: string | null;
  initiatedByUserId: string | null;
}

interface RecordRefundResult {
  refund: Refund;
  payment: Payment;
  fullyRefunded: boolean;
}

/**
 * Executes gateway refunds through Paymob and records the resulting DB state.
 * Shared by AdminService (manual admin refund) and BookingsService (customer
 * self-cancel, T7) so the Paymob transaction-resolution and refund-recording
 * logic exists in exactly one place.
 */
@Injectable()
export class RefundExecutionService {
  private readonly logger = new Logger(RefundExecutionService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    private readonly paymobService: PaymobService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Calls the Paymob gateway (an external call — never wrap this in a DB
   * transaction). Validates the refund won't exceed the payment's remaining
   * refundable amount before calling out.
   */
  async executeGatewayRefund(
    paymentId: string,
    amount: number,
  ): Promise<{ refundId: string }> {
    const payment = await this.paymentRepo.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    const alreadyRefunded = await this.sumSucceededRefunds(paymentId);
    if (alreadyRefunded + amount > payment.amount) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Refund of ${amount} exceeds the remaining refundable amount (${payment.amount - alreadyRefunded}).`,
      });
    }

    const transactionId = await this.resolvePaymobTransactionId(paymentId);
    return this.paymobService.refundTransaction(transactionId, amount);
  }

  /**
   * Writes the Refund row, rolls up the Payment status, and — when the
   * refund fully covers the payment and the booking is cancelled/order_failed
   * — transitions the booking to refunded. Must run inside the caller's
   * transaction (the gateway call has already happened by this point).
   */
  async recordRefund(
    manager: EntityManager,
    params: RecordRefundParams,
  ): Promise<RecordRefundResult> {
    const payment = await manager
      .getRepository(Payment)
      .findOneBy({ id: params.paymentId });
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    const priorRefunds = await manager.getRepository(Refund).findBy({
      paymentId: payment.id,
      status: RefundStatus.Succeeded,
    });
    const alreadyRefunded = priorRefunds.reduce((sum, r) => sum + r.amount, 0);
    const fullyRefunded = alreadyRefunded + params.amount >= payment.amount;

    const refund = new Refund();
    refund.paymentId = payment.id;
    refund.providerRefundId = params.refundId;
    refund.amount = params.amount;
    refund.currency = payment.currency;
    refund.status = RefundStatus.Succeeded;
    refund.reason = params.reason;
    refund.initiatedByUserId = params.initiatedByUserId;
    const savedRefund = await manager.save(Refund, refund);

    payment.status = fullyRefunded
      ? PaymentStatus.Refunded
      : PaymentStatus.PartiallyRefunded;
    const savedPayment = await manager.save(Payment, payment);

    if (fullyRefunded) {
      const booking = await manager
        .getRepository(Booking)
        .findOneBy({ id: payment.bookingId });
      if (
        booking &&
        (booking.status === BookingStatus.Cancelled ||
          booking.status === BookingStatus.OrderFailed)
      ) {
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Refunded,
          params.initiatedByUserId,
          params.reason,
        );
      }
    }

    this.logger.log(
      `Recorded refund ${savedRefund.id} (${params.amount} ${payment.currency}) on payment ${payment.id}, fullyRefunded=${fullyRefunded}`,
    );

    return { refund: savedRefund, payment: savedPayment, fullyRefunded };
  }

  async sumSucceededRefunds(paymentId: string): Promise<number> {
    const refunds = await this.refundRepo.findBy({
      paymentId,
      status: RefundStatus.Succeeded,
    });
    return refunds.reduce((sum, r) => sum + r.amount, 0);
  }

  /**
   * The Paymob refund API needs the transaction id (webhook payload obj.id).
   * Attempts only store the Paymob order id, so it is read back from the
   * stored `transaction.succeeded` webhook event.
   */
  private async resolvePaymobTransactionId(paymentId: string): Promise<number> {
    const event = await this.webhookEventRepo.findOne({
      where: { paymentId, eventType: 'transaction.succeeded' },
      order: { receivedAt: 'DESC' },
    });

    const payload = event?.payload as { obj?: { id?: unknown } } | undefined;
    const rawId: unknown = payload?.obj?.id;
    const transactionId = typeof rawId === 'number' ? rawId : Number(rawId);

    if (!rawId || Number.isNaN(transactionId)) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message:
          'No succeeded gateway transaction found for this payment; cannot refund.',
      });
    }

    return transactionId;
  }
}
