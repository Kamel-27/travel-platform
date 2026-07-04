import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Slice } from './slice.entity';

@Entity('segments')
export class Segment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => Slice, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'fk_segments_slice',
  })
  slice: Slice;

  @Column({ name: 'marketing_carrier', type: 'varchar', length: 2 })
  marketingCarrier: string;

  @Column({ name: 'operating_carrier', type: 'varchar', length: 2 })
  operatingCarrier: string;

  @Column({ name: 'flight_number', type: 'varchar' })
  flightNumber: string;

  @Column({ type: 'varchar', nullable: true })
  aircraft: string | null;

  @Column({ name: 'departing_at_local', type: 'timestamp' }) // without timezone
  departingAtLocal: Date;

  @Column({ name: 'origin_timezone', type: 'varchar' })
  originTimezone: string;

  @Column({ name: 'arriving_at_local', type: 'timestamp' }) // without timezone
  arrivingAtLocal: Date;

  @Column({ name: 'destination_timezone', type: 'varchar' })
  destinationTimezone: string;

  @Column({ name: 'origin_terminal', type: 'varchar', nullable: true })
  originTerminal: string | null;

  @Column({ name: 'destination_terminal', type: 'varchar', nullable: true })
  destinationTerminal: string | null;
}
