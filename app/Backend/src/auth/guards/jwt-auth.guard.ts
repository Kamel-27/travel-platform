import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ErrorCode } from '../../common/dto/error-response.dto';
import type { UserRole } from '../../users/user.entity';

/** Shape attached to request.user after successful JWT verification. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
}

/**
 * Hand-rolled JWT guard (no Passport).
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it with @nestjs/jwt, and attaches the decoded payload
 * to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Missing or malformed authorization header',
      });
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token);
      (request as unknown as Record<string, unknown>)['user'] = payload;
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Invalid or expired access token',
      });
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
