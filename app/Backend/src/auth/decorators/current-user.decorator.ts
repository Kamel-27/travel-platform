import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user payload (set by JwtAuthGuard) from
 * the request.  Usage:
 *
 *   @Get('me')
 *   getMe(@CurrentUser() user: JwtPayload) { … }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return request['user'];
  },
);
