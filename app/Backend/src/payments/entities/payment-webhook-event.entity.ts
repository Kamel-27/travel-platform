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
import { Payment, PaymentProvider } from './payment.entity';
import { PaymentAttempt } from './payment-attempt.entity';

@Entity('payment_webhook_events')
@Unique('ux_payment_webhook_events_provider_event', [
  'provider',
  'providerEventId',
])
@Index('ix_payment_webhook_events_unprocessed', ['processedAt'], {
  where: '"processed_at" IS NULL',
})
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    enumName: 'payment_provider',
  })
  provider: PaymentProvider;

  @Column({ name: 'provider_event_id', type: 'varchar' })
  providerEventId: string;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'payment_id',
    foreignKeyConstraintName: 'fk_payment_webhook_events_payment',
  })
  payment: Payment | null;

  @Column({ name: 'payment_attempt_id', type: 'uuid', nullable: true })
  paymentAttemptId: string | null;

  @ManyToOne(() => PaymentAttempt, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'payment_attempt_id',
    foreignKeyConstraintName: 'fk_payment_webhook_events_payment_attempt',
  })
  paymentAttempt: PaymentAttempt | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
