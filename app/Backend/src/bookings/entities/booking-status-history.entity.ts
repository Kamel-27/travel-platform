import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { User } from '../../users/user.entity';

@Entity('booking_status_history')
export class BookingStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'booking_id',
    foreignKeyConstraintName: 'fk_booking_status_history_booking',
  })
  booking: Booking;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: BookingStatus,
    enumName: 'booking_status',
  })
  fromStatus: BookingStatus;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: BookingStatus,
    enumName: 'booking_status',
  })
  toStatus: BookingStatus;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'changed_by_user_id',
    foreignKeyConstraintName: 'fk_booking_status_history_user',
  })
  changedByUser: User | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
