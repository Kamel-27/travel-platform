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
import { Booking, Supplier } from './booking.entity';

/**
 * The supplier-side twin of PaymentWebhookEvent (erd.md). Duffel delivers
 * order lifecycle events at-least-once, unordered, retried up to 72h.
 *
 * Dedupe on (supplier, supplier_event_id) — Duffel's event `id` (wev_…).
 * `supplier_resource_id` is Duffel's `idempotency_key`, which per their docs
 * is the related resource's own id (ord_…), NOT a per-event key — used only
 * to resolve which booking/order the event is about.
 */
@Entity('supplier_webhook_events')
@Unique('ux_supplier_webhook_events_supplier_event', [
  'supplier',
  'supplierEventId',
])
@Index('ix_supplier_webhook_events_resource', ['supplierResourceId'])
@Index('ix_supplier_webhook_events_unprocessed', ['processedAt'], {
  where: '"processed_at" IS NULL',
})
export class SupplierWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: Supplier,
    enumName: 'supplier_provider',
    default: Supplier.Duffel,
  })
  supplier: Supplier;

  @Column({ name: 'supplier_event_id', type: 'varchar' })
  supplierEventId: string;

  @Column({ name: 'supplier_resource_id', type: 'varchar', nullable: true })
  supplierResourceId: string | null;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_supplier_webhook_events_booking',
  })
  booking: Booking | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
