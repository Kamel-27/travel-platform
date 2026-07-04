import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('documents')
@Index('ix_documents_booking_id', ['bookingId'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_documents_booking',
  })
  booking: Booking;

  /** e.g. electronic_ticket, electronic_miscellaneous_document_associated */
  @Column({ type: 'varchar' })
  type: string;

  /** The e-ticket number or document identifier */
  @Column({ name: 'unique_identifier', type: 'varchar' })
  uniqueIdentifier: string;

  /** Array of Duffel passenger IDs this document covers */
  @Column({ name: 'supplier_passenger_ids', type: 'jsonb', default: '[]' })
  supplierPassengerIds: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
