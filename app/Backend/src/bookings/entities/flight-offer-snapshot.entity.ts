import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking, Supplier } from './booking.entity';
import { Slice } from './slice.entity';

@Entity('flight_offer_snapshots')
export class FlightOfferSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @OneToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_flight_offer_snapshots_booking',
  })
  booking: Booking;

  @Column({
    type: 'enum',
    enum: Supplier,
    enumName: 'supplier_provider',
  })
  supplier: Supplier;

  @Column({ name: 'supplier_offer_id', type: 'varchar' })
  supplierOfferId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'owner_airline_name', type: 'varchar' })
  ownerAirlineName: string;

  @Column({ name: 'owner_airline_iata', type: 'varchar' })
  ownerAirlineIata: string;

  @Column({ name: 'total_amount', type: 'integer' })
  totalAmount: number;

  @Column({ name: 'tax_amount', type: 'integer' })
  taxAmount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'cabin_class', type: 'varchar' })
  cabinClass: string;

  @Column({ type: 'jsonb' })
  conditions: Record<string, unknown>;

  @Column({
    name: 'passenger_identity_documents_required',
    type: 'boolean',
    default: false,
  })
  passengerIdentityDocumentsRequired: boolean;

  @Column({ name: 'raw_offer', type: 'jsonb' })
  rawOffer: Record<string, unknown>;

  @OneToMany(() => Slice, (slice) => slice.offerSnapshot)
  slices: Slice[];

  @CreateDateColumn({ name: 'captured_at', type: 'timestamptz' })
  capturedAt: Date;
}
