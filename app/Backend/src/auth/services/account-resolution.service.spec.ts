/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AccountResolutionService } from './account-resolution.service';
import { User, UserRole } from '../../users/user.entity';
import { AuthIdentity, AuthProvider } from '../entities/auth-identity.entity';

interface MockManagerOptions {
  userQb?: {
    getOne: jest.Mock<Promise<User | null>>;
  };
  identityQb?: {
    insert: jest.Mock<any>;
    into: jest.Mock<any>;
    values: jest.Mock<any>;
    orIgnore: jest.Mock<any>;
    execute: jest.Mock<Promise<any>>;
  };
}

describe('AccountResolutionService', () => {
  let service: AccountResolutionService;
  let mockManager: Record<string, unknown>;

  const createMockManager = (overrides: MockManagerOptions = {}) => {
    const userQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const identityQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };

    const userQbMock = overrides.userQb
      ? { ...userQueryBuilder, ...overrides.userQb }
      : userQueryBuilder;
    const identityQbMock = overrides.identityQb
      ? { ...identityQueryBuilder, ...overrides.identityQb }
      : identityQueryBuilder;

    return {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        return {
          createQueryBuilder: jest.fn().mockImplementation((alias?: string) => {
            if (alias === 'u' || entity === User) {
              return userQbMock;
            }
            return identityQbMock;
          }),
          create: jest
            .fn()
            .mockImplementation((data: Record<string, unknown>) => {
              const now = new Date();
              return {
                id: randomUUID(),
                isActive: true,
                role: UserRole.User,
                createdAt: now,
                updatedAt: now,
                ...data,
              } as User;
            }),
          save: jest.fn().mockImplementation((entityInstance: User) => {
            return Promise.resolve(entityInstance);
          }),
        };
      }),
    };
  };

  beforeEach(() => {
    mockManager = createMockManager();
  });

  const setupTestModule = async (managerInstance: Record<string, unknown>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountResolutionService,
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(AuthIdentity),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation(
                async (cb: (m: unknown) => Promise<unknown>) => {
                  return cb(managerInstance);
                },
              ),
          },
        },
      ],
    }).compile();

    service = module.get<AccountResolutionService>(AccountResolutionService);
  };

  afterEach(() => jest.clearAllMocks());

  it('should create a new user when none exists', async () => {
    await setupTestModule(mockManager);

    const user = await service.resolve(
      'new@example.com',
      AuthProvider.EmailLink,
      null,
    );

    expect(user.email).toBe('new@example.com');
    expect(user.emailVerifiedAt).toBeDefined();
  });

  it('should return existing user without creating a new one', async () => {
    const now = new Date();
    const existingUser: User = {
      id: randomUUID(),
      email: 'existing@example.com',
      isActive: true,
      role: UserRole.User,
      emailVerifiedAt: now,
      fullName: 'Existing User',
      phone: null,
      createdAt: now,
      updatedAt: now,
    };

    mockManager = createMockManager({
      userQb: { getOne: jest.fn().mockResolvedValue(existingUser) },
    });

    await setupTestModule(mockManager);

    const user = await service.resolve(
      'existing@example.com',
      AuthProvider.EmailLink,
      null,
    );

    expect(user.id).toBe(existingUser.id);
  });

  it('should handle double-callback race (unique violation → re-select)', async () => {
    const now = new Date();
    const racedUser: User = {
      id: randomUUID(),
      email: 'race@example.com',
      isActive: true,
      role: UserRole.User,
      emailVerifiedAt: now,
      fullName: 'Race User',
      phone: null,
      createdAt: now,
      updatedAt: now,
    };

    let getOneCallCount = 0;

    const userQbMock = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(() => {
        getOneCallCount++;
        if (getOneCallCount === 1) {
          return Promise.resolve(null);
        }
        return Promise.resolve(racedUser);
      }),
    };

    const identityQbMock = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };

    mockManager = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        return {
          createQueryBuilder: jest.fn().mockImplementation((alias?: string) => {
            if (alias === 'u' || entity === User) {
              return userQbMock;
            }
            return identityQbMock;
          }),
          create: jest
            .fn()
            .mockImplementation((data: Record<string, unknown>) => {
              return data;
            }),
          save: jest.fn().mockRejectedValue({ code: '23505' }),
        };
      }),
    };

    await setupTestModule(mockManager);

    const user = await service.resolve(
      'race@example.com',
      AuthProvider.EmailLink,
      null,
    );

    expect(user.id).toBe(racedUser.id);
  });

  it('should throw ForbiddenException when user is deactivated', async () => {
    const now = new Date();
    const deactivatedUser: User = {
      id: randomUUID(),
      email: 'deactivated@example.com',
      isActive: false,
      role: UserRole.User,
      emailVerifiedAt: now,
      fullName: 'Deactivated User',
      phone: null,
      createdAt: now,
      updatedAt: now,
    };

    mockManager = createMockManager({
      userQb: { getOne: jest.fn().mockResolvedValue(deactivatedUser) },
    });

    await setupTestModule(mockManager);

    await expect(
      service.resolve('deactivated@example.com', AuthProvider.EmailLink, null),
    ).rejects.toThrow(ForbiddenException);
  });
});
