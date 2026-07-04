/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MagicLinkTokenPurgeService } from './magic-link-token-purge.service';
import { MagicLinkToken } from '../entities/magic-link-token.entity';

describe('MagicLinkTokenPurgeService', () => {
  let service: MagicLinkTokenPurgeService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkTokenPurgeService,
        { provide: getRepositoryToken(MagicLinkToken), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(MagicLinkTokenPurgeService);
  });

  it('deletes tokens expired more than 24h ago', async () => {
    await service.purgeExpiredTokens();

    expect(mockRepo.delete).toHaveBeenCalledWith({
      expiresAt: expect.objectContaining({
        _type: 'lessThan',
        _value: expect.any(Date),
      }),
    });
    const cutoff = mockRepo.delete.mock.calls[0][0].expiresAt._value as Date;
    const expectedCutoff = Date.now() - 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });

  it('does not throw when nothing is purged', async () => {
    mockRepo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.purgeExpiredTokens()).resolves.toBeUndefined();
  });
});
