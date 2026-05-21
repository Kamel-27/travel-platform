import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict endpoint access to specific roles.
 * Usage: @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
