import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { MarkupRule } from './markup-rule.entity';

export enum BookingStatus {
  Pending = 'pending',
  AwaitingPayment = 'awaiting_payment',
  Paid = 'paid',
  Confirmed = 'confirmed',
  OrderFailed = 'order_failed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum Supplier {
  Duffel = 'duffel',
}

@Entity('bookings')
@Unique('ux_bookings_supplier_idempotency_key', ['supplierIdempotencyKey'])
@Unique('ux_bookings_supplier_order_id', ['supplierOrderId'])
@Index('ix_bookings_user_created', ['userId', 'createdAt'])
@Index('ix_bookings_booking_reference', ['bookingReference'])
@Check(
  'ck_bookings_total_match',
  '"total_amount" = "base_amount" + "markup_amount"',
)
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_bookings_user',
  })
  user: User;

  @Column({ name: 'markup_rule_id', type: 'uuid', nullable: true })
  markupRuleId: string | null;

  @ManyToOne(() => MarkupRule, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'markup_rule_id',
    foreignKeyConstraintName: 'fk_bookings_markup_rule',
  })
  markupRule: MarkupRule | null;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    enumName: 'booking_status',
    default: BookingStatus.Pending,
  })
  status: BookingStatus;

  @Column({
    type: 'enum',
    enum: Supplier,
    enumName: 'supplier_provider',
    default: Supplier.Duffel,
  })
  supplier: Supplier;

  @Column({ name: 'supplier_idempotency_key', type: 'varchar' })
  supplierIdempotencyKey: string;

  @Column({ name: 'supplier_order_id', type: 'varchar', nullable: true })
  supplierOrderId: string | null;

  @Column({ name: 'booking_reference', type: 'varchar', nullable: true })
  bookingReference: string | null;

  @Column({ name: 'base_amount', type: 'integer' })
  baseAmount: number;

  @Column({ name: 'markup_amount', type: 'integer' })
  markupAmount: number;

  @Column({ name: 'total_amount', type: 'integer' })
  totalAmount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
