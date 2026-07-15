import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Supplier } from '../../bookings/entities/booking.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Refund } from '../../payments/entities/refund.entity';

export enum LedgerEntryType {
  CustomerPayment = 'customer_payment',
  GatewayRefund = 'gateway_refund',
  SupplierCharge = 'supplier_charge',
  SupplierRefund = 'supplier_refund',
  Adjustment = 'adjustment',
}

@Entity('ledger_entries')
@Index('ix_ledger_entries_created_at', ['createdAt'])
@Index('ix_ledger_entries_booking', ['bookingId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: LedgerEntryType,
    enumName: 'ledger_entry_type',
  })
  entryType: LedgerEntryType;

  @Column({ name: 'amount', type: 'integer' })
  amount: number;

  @Column({ name: 'currency', type: 'character', length: 3 })
  currency: string;

  @Column({
    name: 'supplier',
    type: 'enum',
    enum: Supplier,
    enumName: 'supplier_provider',
    nullable: true,
  })
  supplier: Supplier | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'payment_id',
    foreignKeyConstraintName: 'fk_ledger_entries_payment',
  })
  payment: Payment | null;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_ledger_entries_booking',
  })
  booking: Booking | null;

  @Column({ name: 'refund_id', type: 'uuid', nullable: true })
  refundId: string | null;

  @ManyToOne(() => Refund, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'refund_id',
    foreignKeyConstraintName: 'fk_ledger_entries_refund',
  })
  refund: Refund | null;

  @Column({ name: 'note', type: 'varchar', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
