import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { GoogleAuthService } from './google-auth.service';

// Mock google-auth-library
const mockVerifyIdToken = jest.fn();
const mockGetToken = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        generateAuthUrl: jest.fn().mockReturnValue('mock-google-auth-url'),
        getToken: mockGetToken,
        verifyIdToken: mockVerifyIdToken,
      };
    }),
  };
});

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                GOOGLE_CLIENT_ID: 'google-client-id',
                GOOGLE_CLIENT_SECRET: 'google-client-secret',
                GOOGLE_REDIRECT_URI:
                  'http://localhost:3001/api/v1/auth/google/callback',
              };
              return map[key];
            }),
            getOrThrow: jest.fn().mockReturnValue('jwt-secret-key-12345'),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assertConfigured', () => {
    it('should throw ServiceUnavailableException if GOOGLE_CLIENT_ID is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return undefined;
        return 'value';
      });

      // Re-create service to fetch new config values
      const testService = new GoogleAuthService(configService);
      expect(() => testService.assertConfigured()).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('generateAuthUrl', () => {
    it('should return redirect URL, signed state, and verifier', () => {
      const response = service.generateAuthUrl();

      expect(response.url).toBe('mock-google-auth-url');
      expect(response.state).toMatch(/^[a-f0-9]{32}\.[a-f0-9]{64}$/);
      expect(response.codeVerifier).toBeDefined();
    });
  });

  describe('verifyCallback', () => {
    const validNonce = '1234567890abcdef1234567890abcdef';
    const validSignature = createHmac('sha256', 'jwt-secret-key-12345')
      .update(validNonce)
      .digest('hex');
    const validState = `${validNonce}.${validSignature}`;
    const code = 'auth-code-123';
    const verifier = 'code-verifier-abc';

    it('should reject if cookies are missing', async () => {
      await expect(
        service.verifyCallback(code, validState, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if incoming state does not match cookie state', async () => {
      await expect(
        service.verifyCallback(
          code,
          validState,
          'different-cookie-state',
          verifier,
        ),
      ).rejects.toThrow('OAuth state mismatch');
    });

    it('should reject if state signature is invalid or tampered with', async () => {
      const tamperedState = `${validNonce}.wrong-signature`;
      await expect(
        service.verifyCallback(code, tamperedState, tamperedState, verifier),
      ).rejects.toThrow('OAuth state signature is invalid');
    });

    it('should reject if email is not verified', async () => {
      mockGetToken.mockResolvedValue({
        tokens: { id_token: 'mock-id-token' },
      });

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'unverified@example.com',
          email_verified: false, // Unverified
          sub: 'google-sub-123',
          name: 'Unverified User',
        }),
      });

      await expect(
        service.verifyCallback(code, validState, validState, verifier),
      ).rejects.toThrow('Google account email must be verified');
    });

    it('should return email, sub, and name on successful verification', async () => {
      mockGetToken.mockResolvedValue({
        tokens: { id_token: 'mock-id-token' },
      });

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'verified@example.com',
          email_verified: true,
          sub: 'google-sub-999', // should resolve using sub (never email)
          name: 'Verified User',
        }),
      });

      const result = await service.verifyCallback(
        code,
        validState,
        validState,
        verifier,
      );

      expect(result.email).toBe('verified@example.com');
      expect(result.sub).toBe('google-sub-999');
      expect(result.fullName).toBe('Verified User');
    });
  });
});
