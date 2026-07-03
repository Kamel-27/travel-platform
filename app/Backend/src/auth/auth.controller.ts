import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { MagicLinkService } from './services/magic-link.service';
import { TokenService } from './services/token.service';
import type { SessionResponse } from './services/token.service';
import { RequestMagicLinkDto, VerifyMagicLinkDto } from './dto/auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { ErrorCode } from '../common/dto/error-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly magicLinkService: MagicLinkService,
    private readonly tokenService: TokenService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Magic Link ──────────────────────────────────────────────────

  /**
   * POST /auth/magic-link/request
   * Always 202 — no account enumeration.
   */
  @Post('magic-link/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestMagicLink(
    @Body() dto: RequestMagicLinkDto,
    @Req() req: unknown,
  ): Promise<{ message: string }> {
    const typedReq = req as Request;
    await this.magicLinkService.request(dto.email, typedReq.ip ?? null);
    return { message: 'If that email is registered, a link has been sent.' };
  }

  /**
   * POST /auth/magic-link/verify
   * Returns session or 401 TOKEN_INVALID.
   */
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<SessionResponse> {
    const user = await this.magicLinkService.verify(dto.token);
    const typedReq = req as Request;
    const typedRes = res as Response;
    return this.tokenService.createSession(user, typedReq, typedRes);
  }

  // ── Session management ──────────────────────────────────────────

  /**
   * POST /auth/refresh
   * Rotate refresh token (httpOnly cookie) → new session.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<SessionResponse> {
    const typedReq = req as Request;
    const typedRes = res as Response;
    const cookies = typedReq.cookies as Record<string, string> | undefined;
    const rawToken = cookies?.refresh_token;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Missing refresh token',
      });
    }
    return this.tokenService.rotateRefresh(rawToken, typedReq, typedRes);
  }

  /**
   * POST /auth/logout
   * Revoke refresh token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: unknown,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<{ message: string }> {
    const typedReq = req as Request;
    const typedRes = res as Response;
    const cookies = typedReq.cookies as Record<string, string> | undefined;
    const rawToken = cookies?.refresh_token;
    if (rawToken) {
      await this.tokenService.revokeRefresh(rawToken, typedRes);
    }
    return { message: 'Logged out' };
  }

  // ── Current user ────────────────────────────────────────────────

  /**
   * GET /me
   * Returns the current user's profile. Requires JWT auth.
   */
  @Get('/me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() jwtUser: unknown): Promise<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  }> {
    const payload = jwtUser as JwtPayload;
    const user = await this.userRepo.findOneBy({ id: payload.sub });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'User not found',
      });
    }
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
