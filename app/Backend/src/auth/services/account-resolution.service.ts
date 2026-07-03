import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { AuthIdentity, AuthProvider } from '../entities/auth-identity.entity';
import { ErrorCode } from '../../common/dto/error-response.dto';

/**
 * Shared account-resolution logic used by both magic-link and Google OAuth.
 *
 * Implements docs/auth_flow.md §1 verbatim:
 *   resolve(email, provider, provider_user_id?)
 *     in one DB transaction:
 *       SELECT … FROM users WHERE email = $email FOR UPDATE
 *       if none: INSERT user
 *       UPSERT auth_identities ON CONFLICT DO NOTHING
 *
 * Handles the double-callback race via unique-violation catch + re-select.
 */
@Injectable()
export class AccountResolutionService {
  private readonly logger = new Logger(AccountResolutionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuthIdentity)
    private readonly identityRepo: Repository<AuthIdentity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Find or create a user by verified email, upserting the auth identity.
   *
   * @param email         Verified email address
   * @param provider      'google' | 'email_link'
   * @param providerUserId Google sub (for google) or null (for email_link)
   * @param fullName      Optional name from provider profile
   * @returns The resolved User entity
   * @throws ForbiddenException if user.is_active is false
   */
  async resolve(
    email: string,
    provider: AuthProvider,
    providerUserId: string | null,
    fullName?: string | null,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      // Step 1: pessimistic lock on the email row to serialize concurrent logins
      let user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.email = :email', { email: email.toLowerCase() })
        .getOne();

      // Step 2: insert on miss — catch unique violation (double-callback race)
      if (!user) {
        try {
          user = manager.getRepository(User).create({
            email: email.toLowerCase(),
            emailVerifiedAt: new Date(),
            fullName: fullName ?? null,
          });
          user = await manager.getRepository(User).save(user);
        } catch (err: unknown) {
          // Unique violation on users.email — another transaction won the race
          const pgCode =
            err != null &&
            typeof err === 'object' &&
            'code' in err &&
            (err as Record<string, unknown>)['code'];
          if (pgCode === '23505') {
            this.logger.debug(
              `Double-callback race detected for ${email}, re-selecting`,
            );
            user = await manager
              .getRepository(User)
              .createQueryBuilder('u')
              .setLock('pessimistic_write')
              .where('u.email = :email', { email: email.toLowerCase() })
              .getOne();

            if (!user) {
              // Should never happen after a unique violation, but be safe
              throw new Error(
                `User re-select failed after unique violation for ${email}`,
              );
            }
          } else {
            throw err;
          }
        }
      }

      // Step 3: is_active check — deactivated users cannot log in
      if (!user.isActive) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Account is deactivated',
        });
      }

      // Step 4: upsert identity — ON CONFLICT DO NOTHING
      await manager
        .getRepository(AuthIdentity)
        .createQueryBuilder()
        .insert()
        .into(AuthIdentity)
        .values({
          userId: user.id,
          provider,
          providerUserId,
        })
        .orIgnore()
        .execute();

      return user;
    });
  }
}
