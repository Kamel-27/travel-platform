import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

export enum PassengerType {
  Adult = 'adult',
  Child = 'child',
  Infant = 'infant',
}

export enum PassengerTitle {
  Mr = 'mr',
  Ms = 'ms',
  Mrs = 'mrs',
  Miss = 'miss',
}

export enum PassengerGender {
  M = 'm',
  F = 'f',
}

@Entity('passengers')
@Check(
  'ck_passengers_infant_adult',
  '"type" != \'infant\' OR "responsible_adult_passenger_id" IS NOT NULL',
)
@Index(
  'ux_passengers_booking_supplier_pax',
  ['bookingId', 'supplierPassengerId'],
  {
    unique: true,
    where: '"supplier_passenger_id" IS NOT NULL',
  },
)
export class Passenger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_passengers_booking',
  })
  booking: Booking;

  @Column({ name: 'supplier_passenger_id', type: 'varchar', nullable: true })
  supplierPassengerId: string | null;

  @Column({
    type: 'enum',
    enum: PassengerType,
    enumName: 'passenger_type',
  })
  type: PassengerType;

  @Column({
    type: 'enum',
    enum: PassengerTitle,
    enumName: 'passenger_title',
  })
  title: PassengerTitle;

  @Column({
    type: 'enum',
    enum: PassengerGender,
    enumName: 'passenger_gender',
  })
  gender: PassengerGender;

  @Column({ name: 'given_name', type: 'varchar' })
  givenName: string;

  @Column({ name: 'family_name', type: 'varchar' })
  familyName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string; // TypeORM maps date to YYYY-MM-DD string

  @Column({ name: 'phone_number', type: 'varchar' })
  phoneNumber: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({
    name: 'responsible_adult_passenger_id',
    type: 'uuid',
    nullable: true,
  })
  responsibleAdultPassengerId: string | null;

  @ManyToOne(() => Passenger, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'responsible_adult_passenger_id',
    foreignKeyConstraintName: 'fk_passengers_responsible_adult',
  })
  responsibleAdult: Passenger | null;

  @Column({ name: 'document_type', type: 'varchar', nullable: true })
  documentType: string | null;

  @Column({ name: 'document_number', type: 'varchar', nullable: true })
  documentNumber: string | null;

  @Column({ name: 'document_expiry', type: 'date', nullable: true })
  documentExpiry: string | null;

  @Column({ type: 'varchar', nullable: true })
  nationality: string | null;
}
