import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Marks an endpoint as requiring one of the listed roles.
 * Checked by RolesGuard.
 *
 *   @Roles(UserRole.TechnicalAdmin)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Delete(':id')
 *   remove() { … }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
