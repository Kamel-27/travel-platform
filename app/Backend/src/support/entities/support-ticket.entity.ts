import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum SupportTicketType {
  Cancellation = 'cancellation',
  FlightDelay = 'flight_delay',
  NameChange = 'name_change',
  Refund = 'refund',
  Other = 'other',
}

export enum SupportTicketStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Resolved = 'resolved',
}

@Entity('support_tickets')
@Index('ix_support_tickets_user_created', ['userId', 'createdAt'])
@Index('ix_support_tickets_status_created', ['status', 'createdAt'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_support_tickets_user',
  })
  user: User;

  @Column({
    type: 'enum',
    enum: SupportTicketType,
    enumName: 'support_ticket_type',
  })
  type: SupportTicketType;

  /**
   * Free-text PNR as entered by the customer — deliberately NOT a foreign
   * key: users may reference bookings made under another account or mistype,
   * and the ticket must still be creatable. Admins resolve it manually via
   * /admin/bookings?reference=.
   */
  @Column({ name: 'booking_reference', type: 'varchar', nullable: true })
  bookingReference: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: SupportTicketStatus,
    enumName: 'support_ticket_status',
    default: SupportTicketStatus.Open,
  })
  status: SupportTicketStatus;

  /** Visible to the customer as the support team's reply/resolution note. */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
