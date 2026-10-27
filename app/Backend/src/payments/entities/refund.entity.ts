import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentAttempt } from './payment-attempt.entity';
import { User } from '../../users/user.entity';

export enum RefundStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

@Entity('refunds')
@Unique('ux_refunds_provider_refund_id', ['providerRefundId'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'payment_id',
    foreignKeyConstraintName: 'fk_refunds_payment',
  })
  payment: Payment;

  /** Assigned by Paymob only once the refund executes; null while pending/failed. */
  @Column({ name: 'provider_refund_id', type: 'varchar', nullable: true })
  providerRefundId: string | null;

  /**
   * Set only for a refund of one specific capture that should not have
   * happened (a second succeeded attempt on an already paid booking). Such a
   * refund targets that attempt's transaction, is not counted against the
   * booking-level refundable balance, and never rolls the booking up to
   * `refunded`. Null for ordinary payment-level refunds.
   */
  @Column({ name: 'payment_attempt_id', type: 'uuid', nullable: true })
  paymentAttemptId: string | null;

  @ManyToOne(() => PaymentAttempt, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'payment_attempt_id',
    foreignKeyConstraintName: 'fk_refunds_payment_attempt',
  })
  paymentAttempt: PaymentAttempt | null;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'supplier_refund_amount', type: 'integer', nullable: true })
  supplierRefundAmount: number | null;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    enumName: 'refund_status',
    default: RefundStatus.Pending,
  })
  status: RefundStatus;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ name: 'initiated_by_user_id', type: 'uuid', nullable: true })
  initiatedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'initiated_by_user_id',
    foreignKeyConstraintName: 'fk_refunds_user',
  })
  initiatedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
