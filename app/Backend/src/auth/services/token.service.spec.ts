/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { TokenService } from './token.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User, UserRole } from '../../users/user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;
  let refreshRepoSaveMock: jest.Mock<Promise<RefreshToken>>;
  let refreshRepoFindOneMock: jest.Mock<Promise<RefreshToken | null>>;
  let refreshRepoUpdateMock: jest.Mock<Promise<any>>;
  let refreshRepoCreateMock: jest.Mock<RefreshToken>;
  let refreshRepoQueryBuilderMock: Record<string, unknown>;

  const mockUser: User = {
    id: randomUUID(),
    email: 'test@example.com',
    emailVerifiedAt: new Date(),
    fullName: 'Test User',
    phone: null,
    role: UserRole.User,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = {
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  } as unknown as Request;

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    pipeline: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  };

  beforeEach(async () => {
    refreshRepoSaveMock = jest
      .fn()
      .mockImplementation((entity: RefreshToken) => Promise.resolve(entity));
    refreshRepoFindOneMock = jest.fn();
    refreshRepoUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    refreshRepoCreateMock = jest.fn().mockImplementation(
      (data: Partial<RefreshToken>) =>
        ({
          id: randomUUID(),
          ...data,
        }) as RefreshToken,
    );

    refreshRepoQueryBuilderMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockRepo = {
      create: refreshRepoCreateMock,
      save: refreshRepoSaveMock,
      findOne: refreshRepoFindOneMock,
      update: refreshRepoUpdateMock,
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(refreshRepoQueryBuilderMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const map: Record<string, unknown> = {
                ACCESS_TOKEN_TTL_SECONDS: 900,
                REFRESH_TOKEN_TTL_DAYS: 30,
                NODE_ENV: 'development',
              };
              return map[key] ?? fallback;
            }),
            getOrThrow: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it('should issue an access JWT with correct sub and role', async () => {
      const session = await service.createSession(mockUser, mockReq, mockRes);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, role: mockUser.role },
        { expiresIn: 900 },
      );
      expect(session.access_token).toBe('mock-jwt-token');
      expect(session.expires_in).toBe(900);
    });

    it('should return the public user shape', async () => {
      const session = await service.createSession(mockUser, mockReq, mockRes);

      expect(session.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        full_name: mockUser.fullName,
        phone: mockUser.phone,
        role: mockUser.role,
      });
    });

    it('should store a hashed refresh token (not raw)', async () => {
      await service.createSession(mockUser, mockReq, mockRes);

      const savedEntity = refreshRepoSaveMock.mock.calls[0][0];
      expect(savedEntity.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should set the refresh token as an httpOnly cookie', async () => {
      await service.createSession(mockUser, mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/v1/auth',
        }),
      );
    });
  });

  describe('rotateRefresh', () => {
    it('should revoke old token and issue new one in the same family', async () => {
      const familyId = randomUUID();
      const rawToken = 'test-raw-token';
      const hash = createHash('sha256').update(rawToken).digest('hex');

      const existingToken: RefreshToken = {
        id: randomUUID(),
        tokenHash: hash,
        familyId,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: mockUser,
        userAgent: 'agent',
        ip: '127.0.0.1',
        createdAt: new Date(),
      };

      refreshRepoFindOneMock.mockResolvedValue(existingToken);

      const session = await service.rotateRefresh(rawToken, mockReq, mockRes);

      expect(existingToken.revokedAt).not.toBeNull();
      expect(refreshRepoSaveMock).toHaveBeenCalledWith(existingToken);
      expect(session.access_token).toBe('mock-jwt-token');

      const newSaved = refreshRepoSaveMock.mock.calls[1][0];
      expect(newSaved.familyId).toBe(familyId);
    });

    it('should revoke entire family when a rotated token is reused (theft detection)', async () => {
      const familyId = randomUUID();
      const rawToken = 'reused-token';
      const hash = createHash('sha256').update(rawToken).digest('hex');

      const revokedToken: RefreshToken = {
        id: randomUUID(),
        tokenHash: hash,
        familyId,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Already revoked = reuse
        user: mockUser,
        userAgent: 'agent',
        ip: '127.0.0.1',
        createdAt: new Date(),
      };

      refreshRepoFindOneMock.mockResolvedValue(revokedToken);

      await expect(
        service.rotateRefresh(rawToken, mockReq, mockRes),
      ).rejects.toThrow('Refresh token reuse detected');

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(Object),
      );
    });

    it('should reject an expired refresh token with 401', async () => {
      const rawToken = 'expired-token';
      const hash = createHash('sha256').update(rawToken).digest('hex');

      refreshRepoFindOneMock.mockResolvedValue({
        id: randomUUID(),
        tokenHash: hash,
        familyId: randomUUID(),
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 1000), // Expired
        revokedAt: null,
        user: mockUser,
        userAgent: 'agent',
        ip: '127.0.0.1',
        createdAt: new Date(),
      });

      await expect(
        service.rotateRefresh(rawToken, mockReq, mockRes),
      ).rejects.toThrow('Refresh token expired');
    });

    it('should reject an unknown refresh token with 401', async () => {
      refreshRepoFindOneMock.mockResolvedValue(null);

      await expect(
        service.rotateRefresh('unknown-token', mockReq, mockRes),
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeRefresh', () => {
    it('should mark the token as revoked and clear the cookie', async () => {
      await service.revokeRefresh('some-token', mockRes);

      expect(refreshRepoUpdateMock).toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(Object),
      );
    });
  });
});
