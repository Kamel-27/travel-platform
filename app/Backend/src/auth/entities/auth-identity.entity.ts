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
import { User } from '../../users/user.entity';

export enum AuthProvider {
  Google = 'google',
  EmailLink = 'email_link',
}

// Identity rows ARE the credentials (passwordless), so uniqueness is enforced
// hard at the DB level — see docs/erd.md (AuthIdentity) and docs/auth_flow.md §1.
@Entity('auth_identities')
@Unique('ux_auth_identities_user_provider', ['userId', 'provider'])
@Index('ux_auth_identities_provider_user', ['provider', 'providerUserId'], {
  unique: true,
  where: '"provider_user_id" IS NOT NULL',
})
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_auth_identities_user',
  })
  user: User;

  @Column({ type: 'enum', enum: AuthProvider, enumName: 'auth_provider' })
  provider: AuthProvider;

  // Google's stable `sub` claim (emails can change); null for email_link
  @Column({ name: 'provider_user_id', type: 'varchar', nullable: true })
  providerUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
