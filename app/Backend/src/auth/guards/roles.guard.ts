import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from './jwt-auth.guard';
import { ErrorCode } from '../../common/dto/error-response.dto';

/**
 * Checks the @Roles() metadata on the handler.
 * If no roles are set → allow (the guard is opt-in per endpoint).
 * If the user's role is not in the allowed set → 403 FORBIDDEN.
 *
 * Must be used AFTER JwtAuthGuard so that request.user is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request['user'] as JwtPayload | undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
