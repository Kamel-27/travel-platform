import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { GoogleAuthService } from './services/google-auth.service';
import { AccountResolutionService } from './services/account-resolution.service';
import { AuthProvider } from './entities/auth-identity.entity';

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly webAppUrl: string;

  constructor(
    private readonly magicLinkService: MagicLinkService,
    private readonly tokenService: TokenService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly accountResolutionService: AccountResolutionService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.isProduction = this.config.get('NODE_ENV') === 'production';
    this.webAppUrl = this.config.get<string>(
      'WEB_APP_URL',
      'http://localhost:3000',
    );
  }

  // ── Google OAuth 🔓 ──────────────────────────────────────────────

  /**
   * GET /auth/google
   * Initiates Google OAuth flow. Generates state (HMAC signed) and
   * PKCE verifier, saves them in 10-minute httpOnly cookies, and redirects
   * to Google.
   */
  @Get('google')
  googleLogin(@Res() res: unknown): void {
    const typedRes = res as Response;
    const { url, state, codeVerifier } =
      this.googleAuthService.generateAuthUrl();

    // Store state and verifier in 10-minute httpOnly cookies scoped to OAuth callback path
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: 10 * 60 * 1000, // 10 minutes
    };

    typedRes.cookie('oauth_google_state', state, cookieOptions);
    typedRes.cookie('oauth_google_verifier', codeVerifier, cookieOptions);

    typedRes.redirect(url);
  }

  /**
   * GET /auth/google/callback
   * Callback from Google: verifies state, exchanges authorization code,
   * verify id_token (require email_verified), resolves user account,
   * sets refresh cookie, and redirects user back to the web application.
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: unknown,
    @Res() res: unknown,
  ): Promise<void> {
    const typedReq = req as Request;
    const typedRes = res as Response;

    const cookies = typedReq.cookies as Record<string, string> | undefined;
    const cookieState = cookies?.oauth_google_state;
    const cookieVerifier = cookies?.oauth_google_verifier;

    // Clear state/verifier cookies immediately
    const clearOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
    typedRes.clearCookie('oauth_google_state', clearOptions);
    typedRes.clearCookie('oauth_google_verifier', clearOptions);

    // Verify callback and exchange auth code
    const googleUser = await this.googleAuthService.verifyCallback(
      code,
      state,
      cookieState,
      cookieVerifier,
    );

    // Resolve the account (find-or-create user and auth identity)
    const user = await this.accountResolutionService.resolve(
      googleUser.email,
      AuthProvider.Google,
      googleUser.sub,
      googleUser.fullName,
    );

    // Set refresh token cookie on res
    await this.tokenService.createSession(user, typedReq, typedRes);

    // Redirect user back to the web application callback page
    typedRes.redirect(`${this.webAppUrl}/auth/callback`);
  }

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
