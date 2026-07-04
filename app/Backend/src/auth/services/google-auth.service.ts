import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash, createHmac, randomBytes } from 'crypto';
import { ErrorCode } from '../../common/dto/error-response.dto';

export interface GoogleAuthUrlResponse {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface GoogleUserResult {
  email: string;
  sub: string;
  fullName?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string | undefined;
  private readonly jwtSecret: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    this.redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI');
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
  }

  /**
   * Asserts that Google OAuth credentials are fully configured.
   * If not, throws a 503 Service Unavailable exception so the app doesn't crash
   * but the endpoints return a clean error to the client.
   */
  assertConfigured(): void {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Google login is currently unconfigured and unavailable.',
      });
    }
  }

  /**
   * Initiates Google OAuth sequence:
   * 1. Generates 16 random bytes as a state nonce.
   * 2. Signs state nonce with JWT_SECRET using HMAC-SHA256.
   * 3. Generates PKCE code_verifier and S256 code_challenge.
   * 4. Constructs Google redirect authorization URL.
   */
  generateAuthUrl(): GoogleAuthUrlResponse {
    this.assertConfigured();

    const client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });

    const nonce = randomBytes(16).toString('hex');
    const signature = this.signState(nonce);
    const signedState = `${nonce}.${signature}`;

    // PKCE generation
    const codeVerifier = randomBytes(32).toString('base64url');
    // S256 code challenge: base64url(sha256(verifier))
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    // Wait, google-auth-library's OAuth2Client can generate authorization URLs
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: signedState,
      code_challenge: codeChallenge,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      code_challenge_method: 'S256' as any,
    });

    return {
      url,
      state: signedState,
      codeVerifier,
    };
  }

  /**
   * Verifies the redirect callback from Google:
   * 1. Validates the signature of the incoming state parameter.
   * 2. Exchanges the authorization code for an ID token using PKCE.
   * 3. Verifies the ID token (aud, iss, exp).
   * 4. Ensures the user's email is verified on Google.
   */
  async verifyCallback(
    code: string,
    stateParam: string,
    cookieState: string | undefined,
    cookieVerifier: string | undefined,
  ): Promise<GoogleUserResult> {
    this.assertConfigured();

    if (!cookieState || !cookieVerifier) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Missing OAuth session context. Please try logging in again.',
      });
    }

    // CSRF Guard: Compare incoming state against session cookie state
    if (stateParam !== cookieState) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'OAuth state mismatch. Potential CSRF attack detected.',
      });
    }

    // HMAC verification of the state signature
    const [nonce, signature] = stateParam.split('.');
    if (!nonce || !signature || this.signState(nonce) !== signature) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'OAuth state signature is invalid or tampered with.',
      });
    }

    const client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });

    try {
      // Exchange code for tokens using the stored code_verifier
      const { tokens } = await client.getToken({
        code,
        codeVerifier: cookieVerifier,
      });

      if (!tokens.id_token) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Google did not return a valid ID token.',
        });
      }

      // Verify the ID token signature and claims
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Failed to extract Google ID token payload.',
        });
      }

      // Require email_verified === true per docs/auth_flow.md §2
      if (payload.email_verified !== true) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Google account email must be verified to log in.',
        });
      }

      if (!payload.sub || !payload.email) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Google ID token is missing required claims (sub, email).',
        });
      }

      return {
        email: payload.email,
        sub: payload.sub,
        fullName: payload.name,
      };
    } catch (err: unknown) {
      this.logger.error('Google OAuth exchange failed', err);
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message:
          err instanceof Error
            ? `Google OAuth failed: ${err.message}`
            : 'Google OAuth token exchange failed.',
      });
    }
  }

  private signState(nonce: string): string {
    return createHmac('sha256', this.jwtSecret).update(nonce).digest('hex');
  }
}
