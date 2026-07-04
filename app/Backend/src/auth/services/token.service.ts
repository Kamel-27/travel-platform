import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { ErrorCode } from '../../common/dto/error-response.dto';
import { User } from '../../users/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

/** Shape of the JWT access-token payload. */
export interface AccessTokenPayload {
  sub: string;
  role: string;
}

/** Public user shape returned in session responses. */
export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

/** Session response body per api_contract.md §1. */
export interface SessionResponse {
  access_token: string;
  expires_in: number;
  user: SessionUser;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;
  private readonly isProduction: boolean;
  // Frontend (Vercel) and backend (Railway) live on different domains in
  // production, so the refresh cookie must be SameSite=None (requires
  // Secure) to survive the cross-site fetch from api-client.ts; 'lax' only
  // works in dev because everything there is same-site (localhost).
  private readonly cookieSameSite: 'lax' | 'none';

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {
    this.accessTtlSeconds = this.config.get<number>(
      'ACCESS_TOKEN_TTL_SECONDS',
      900,
    );
    this.refreshTtlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    this.isProduction = this.config.get('NODE_ENV') === 'production';
    this.cookieSameSite = this.isProduction ? 'none' : 'lax';
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Issue a full session (access JWT + refresh cookie) for the given user.
   */
  async createSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<SessionResponse> {
    const accessToken = this.issueAccessToken(user);
    const familyId = randomUUID();
    await this.issueRefreshToken(user, familyId, req, res);

    return {
      access_token: accessToken,
      expires_in: this.accessTtlSeconds,
      user: this.toSessionUser(user),
    };
  }

  /**
   * Rotate the refresh token: verify the old one, revoke it, issue a new
   * one in the same family. Returns a new session.
   *
   * If the presented token was already revoked, this is a reuse/theft signal
   * → revoke the entire family.
   */
  async rotateRefresh(
    rawToken: string,
    req: Request,
    res: Response,
  ): Promise<SessionResponse> {
    const hash = this.hashToken(rawToken);

    const existing = await this.refreshRepo.findOne({
      where: { tokenHash: hash },
      relations: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Invalid refresh token',
      });
    }

    // Expired
    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Refresh token expired',
      });
    }

    // Atomically claim the token: exactly one concurrent caller can revoke it.
    // 0 affected rows = already revoked (reuse/theft, or we lost a concurrent
    // rotation race) → revoke the entire family.
    const claim = await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('token_hash = :hash AND revoked_at IS NULL', { hash })
      .execute();

    if (!claim.affected) {
      this.logger.warn(
        `Refresh token reuse detected for family ${existing.familyId}, user ${existing.userId}. Revoking entire family.`,
      );
      await this.revokeFamilyTokens(existing.familyId);
      this.clearRefreshCookie(res);
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Refresh token reuse detected — session revoked',
      });
    }

    // Issue a new token in the same family
    const user = existing.user;
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Account is deactivated',
      });
    }

    const accessToken = this.issueAccessToken(user);
    await this.issueRefreshToken(user, existing.familyId, req, res);

    return {
      access_token: accessToken,
      expires_in: this.accessTtlSeconds,
      user: this.toSessionUser(user),
    };
  }

  /**
   * Revoke a single refresh token (logout).
   */
  async revokeRefresh(rawToken: string, res: Response): Promise<void> {
    const hash = this.hashToken(rawToken);
    await this.refreshRepo.update(
      { tokenHash: hash },
      { revokedAt: new Date() },
    );
    this.clearRefreshCookie(res);
  }

  // ─── Internals ────────────────────────────────────────────────────

  private issueAccessToken(user: User): string {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTtlSeconds,
    });
  }

  private async issueRefreshToken(
    user: User,
    familyId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('base64url');
    const hash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTtlDays);

    const token = this.refreshRepo.create({
      userId: user.id,
      tokenHash: hash,
      familyId,
      expiresAt,
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    });
    await this.refreshRepo.save(token);

    // Set the refresh token as an httpOnly cookie
    res.cookie('refresh_token', rawToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.cookieSameSite,
      path: '/api/v1/auth',
      maxAge: this.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private async revokeFamilyTokens(familyId: string): Promise<void> {
    // Revoke all non-revoked tokens in the family (theft → scorched earth)
    await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('family_id = :familyId AND revoked_at IS NULL', { familyId })
      .execute();
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.cookieSameSite,
      path: '/api/v1/auth',
    });
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
