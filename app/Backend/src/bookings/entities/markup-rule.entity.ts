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

export enum MarkupType {
  Percentage = 'percentage',
  Fixed = 'fixed',
}

@Entity('markup_rules')
@Index('ux_markup_rules_active_one', ['isActive'], {
  unique: true,
  where: 'is_active = true',
})
export class MarkupRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MarkupType,
    enumName: 'markup_type',
  })
  type: MarkupType;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  value: string; // TypeORM maps decimals to strings in JavaScript to avoid float precision issues

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by_user_id',
    foreignKeyConstraintName: 'fk_markup_rules_created_by',
  })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
