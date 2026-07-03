/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { MagicLinkService } from './magic-link.service';
import { MagicLinkToken } from '../entities/magic-link-token.entity';
import { AccountResolutionService } from './account-resolution.service';
import { MailService } from './mail.service';
import { User, UserRole } from '../../users/user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';

describe('MagicLinkService', () => {
  let service: MagicLinkService;
  let magicLinkRepoCreateMock: jest.Mock<MagicLinkToken>;
  let magicLinkRepoSaveMock: jest.Mock<Promise<MagicLinkToken>>;
  let magicLinkRepoFindOneMock: jest.Mock<Promise<MagicLinkToken | null>>;
  let magicLinkRepoQueryBuilderMock: Record<string, unknown>;
  let mockRedis: Record<string, unknown>;
  let accountResolutionResolveMock: jest.Mock<Promise<User>>;
  let mailServiceSendMock: jest.Mock<void>;

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

  beforeEach(async () => {
    magicLinkRepoCreateMock = jest.fn().mockImplementation(
      (data: Partial<MagicLinkToken>) =>
        ({
          id: randomUUID(),
          ...data,
        }) as MagicLinkToken,
    );

    magicLinkRepoSaveMock = jest
      .fn()
      .mockImplementation((entity: MagicLinkToken) => Promise.resolve(entity));

    magicLinkRepoFindOneMock = jest.fn();

    magicLinkRepoQueryBuilderMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockRepo = {
      create: magicLinkRepoCreateMock,
      save: magicLinkRepoSaveMock,
      findOne: magicLinkRepoFindOneMock,
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(magicLinkRepoQueryBuilderMock),
    };

    const mockRedisGet = jest.fn().mockResolvedValue(null);
    mockRedis = {
      get: mockRedisGet,
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    accountResolutionResolveMock = jest.fn().mockResolvedValue(mockUser);
    const mockAccountResolution = {
      resolve: accountResolutionResolveMock,
    };

    mailServiceSendMock = jest.fn();
    const mockMailService = {
      sendMagicLink: mailServiceSendMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkService,
        {
          provide: getRepositoryToken(MagicLinkToken),
          useValue: mockRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: AccountResolutionService,
          useValue: mockAccountResolution,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<MagicLinkService>(MagicLinkService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('request', () => {
    it('should store a hash (not raw token) and send the link', async () => {
      await service.request('user@example.com', '127.0.0.1');

      expect(magicLinkRepoCreateMock).toHaveBeenCalled();
      const created = magicLinkRepoCreateMock.mock.calls[0][0];
      expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(created.email).toBe('user@example.com');

      expect(mailServiceSendMock).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
    });

    it('should silently skip when email rate limit is reached', async () => {
      const mockGet = mockRedis['get'] as jest.Mock;
      mockGet.mockImplementation((key: string) => {
        if (key.startsWith('magic_link:email:')) {
          return Promise.resolve('3');
        }
        return Promise.resolve(null);
      });

      await service.request('limited@example.com', '127.0.0.1');

      expect(magicLinkRepoCreateMock).not.toHaveBeenCalled();
      expect(mailServiceSendMock).not.toHaveBeenCalled();
    });

    it('should silently skip when IP rate limit is reached', async () => {
      const mockGet = mockRedis['get'] as jest.Mock;
      mockGet.mockImplementation((key: string) => {
        if (key.startsWith('magic_link:ip:')) {
          return Promise.resolve('10');
        }
        return Promise.resolve(null);
      });

      await service.request('user@example.com', '1.2.3.4');

      expect(magicLinkRepoCreateMock).not.toHaveBeenCalled();
      expect(mailServiceSendMock).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should mark token as used and resolve the account', async () => {
      const rawToken = 'valid-raw-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      magicLinkRepoFindOneMock.mockResolvedValue({
        id: randomUUID(),
        email: 'test@example.com',
        tokenHash,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        userId: null,
        user: null,
        requestedIp: null,
        createdAt: new Date(),
      });

      const user = await service.verify(rawToken);

      expect(user.id).toBe(mockUser.id);
      expect(accountResolutionResolveMock).toHaveBeenCalledWith(
        'test@example.com',
        'email_link',
        null,
      );
    });

    it('should reject an unknown token with 401 TOKEN_INVALID', async () => {
      magicLinkRepoFindOneMock.mockResolvedValue(null);

      await expect(service.verify('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an expired token with 401 TOKEN_INVALID', async () => {
      magicLinkRepoFindOneMock.mockResolvedValue({
        id: randomUUID(),
        email: 'test@example.com',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
        userId: null,
        user: null,
        requestedIp: null,
        createdAt: new Date(),
      });

      await expect(service.verify('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an already-used token with 401 TOKEN_INVALID', async () => {
      magicLinkRepoFindOneMock.mockResolvedValue({
        id: randomUUID(),
        email: 'test@example.com',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: new Date(), // Already used
        userId: null,
        user: null,
        requestedIp: null,
        createdAt: new Date(),
      });

      await expect(service.verify('used-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject double-click verify (atomic guard)', async () => {
      const tokenId = randomUUID();
      magicLinkRepoFindOneMock.mockResolvedValue({
        id: tokenId,
        email: 'test@example.com',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        userId: null,
        user: null,
        requestedIp: null,
        createdAt: new Date(),
      });

      // Simulate another request beat us: affected = 0
      const executeMock = jest.fn().mockResolvedValue({ affected: 0 });
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: executeMock,
      };

      const mockRepo = {
        create: magicLinkRepoCreateMock,
        save: magicLinkRepoSaveMock,
        findOne: magicLinkRepoFindOneMock,
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MagicLinkService,
          {
            provide: getRepositoryToken(MagicLinkToken),
            useValue: mockRepo,
          },
          {
            provide: REDIS_CLIENT,
            useValue: mockRedis,
          },
          {
            provide: AccountResolutionService,
            useValue: { resolve: accountResolutionResolveMock },
          },
          {
            provide: MailService,
            useValue: { sendMagicLink: mailServiceSendMock },
          },
        ],
      }).compile();

      const customService = module.get<MagicLinkService>(MagicLinkService);

      await expect(customService.verify('race-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
