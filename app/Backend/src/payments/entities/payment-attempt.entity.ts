import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum PaymentAttemptStatus {
  RequiresAction = 'requires_action',
  Processing = 'processing',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

@Entity('payment_attempts')
@Unique('ux_payment_attempts_provider_ref', ['providerReferenceId'])
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'payment_id',
    foreignKeyConstraintName: 'fk_payment_attempts_payment',
  })
  payment: Payment;

  @Index('ix_payment_attempts_provider_ref')
  @Column({ name: 'provider_reference_id', type: 'varchar' })
  providerReferenceId: string;

  @Column({
    type: 'enum',
    enum: PaymentAttemptStatus,
    enumName: 'payment_attempt_status',
  })
  status: PaymentAttemptStatus;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  method: string | null;

  @CreateDateColumn({ name: 'attempted_at', type: 'timestamptz' })
  attemptedAt: Date;
}
