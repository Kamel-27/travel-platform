import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FlightOfferSnapshot } from './flight-offer-snapshot.entity';
import { Segment } from './segment.entity';

@Entity('slices')
export class Slice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'offer_snapshot_id', type: 'uuid' })
  offerSnapshotId: string;

  @ManyToOne(() => FlightOfferSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'offer_snapshot_id',
    foreignKeyConstraintName: 'fk_slices_offer_snapshot',
  })
  offerSnapshot: FlightOfferSnapshot;

  @Column({ type: 'varchar', length: 3 })
  origin: string;

  @Column({ type: 'varchar', length: 3 })
  destination: string;

  @Column({ type: 'varchar' })
  duration: string;

  @Column({ name: 'fare_brand_name', type: 'varchar', nullable: true })
  fareBrandName: string | null;

  @OneToMany(() => Segment, (segment) => segment.slice)
  segments: Segment[];
}
