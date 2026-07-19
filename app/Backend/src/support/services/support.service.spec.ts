import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { SupportService } from './support.service';
import {
  SupportTicket,
  SupportTicketStatus,
  SupportTicketType,
} from '../entities/support-ticket.entity';

describe('SupportService', () => {
  let service: SupportService;
  let ticketRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    findOneBy: jest.Mock;
  };
  let entityManager: { transaction: jest.Mock };
  let auditLogService: { logAction: jest.Mock };
  let txManager: { save: jest.Mock };

  const baseTicket = (): SupportTicket =>
    ({
      id: 'ticket-1',
      userId: 'user-1',
      type: SupportTicketType.Cancellation,
      bookingReference: 'ABC123',
      description: 'Please cancel my flight',
      status: SupportTicketStatus.Open,
      adminNote: null,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    }) as SupportTicket;

  beforeEach(() => {
    ticketRepo = {
      create: jest.fn((data: Partial<SupportTicket>) => data),
      save: jest.fn((t: Partial<SupportTicket>) =>
        Promise.resolve({ ...baseTicket(), ...t }),
      ),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOneBy: jest.fn(),
    };
    txManager = { save: jest.fn((_entity, t) => Promise.resolve(t)) };
    entityManager = {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(txManager)),
    };
    auditLogService = { logAction: jest.fn() };

    service = new SupportService(
      ticketRepo as unknown as Repository<SupportTicket>,
      entityManager as unknown as EntityManager,
      auditLogService,
    );
  });

  describe('createTicket', () => {
    it('normalizes the booking reference (trims, strips leading #)', async () => {
      await service.createTicket('user-1', {
        type: SupportTicketType.Refund,
        booking_reference: ' #KKJNPU ',
        description: 'I want my money back please',
      });

      expect(ticketRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingReference: 'KKJNPU' }),
      );
    });

    it('stores null when no booking reference is provided', async () => {
      await service.createTicket('user-1', {
        type: SupportTicketType.Other,
        description: 'General question about baggage',
      });

      expect(ticketRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingReference: null }),
      );
    });

    it('returns the snake_case wire view', async () => {
      const view = await service.createTicket('user-1', {
        type: SupportTicketType.Cancellation,
        booking_reference: 'ABC123',
        description: 'Please cancel my flight',
      });

      expect(view).toMatchObject({
        booking_reference: 'ABC123',
        status: SupportTicketStatus.Open,
        admin_note: null,
      });
    });
  });

  describe('listMyTickets', () => {
    it('returns only the caller tickets newest first', async () => {
      ticketRepo.find.mockResolvedValue([baseTicket()]);

      const res = await service.listMyTickets('user-1');

      expect(ticketRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('ticket-1');
    });
  });

  describe('updateTicket', () => {
    it('throws NOT_FOUND for an unknown ticket', async () => {
      ticketRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateTicket('admin-1', 'nope', {
          status: SupportTicketStatus.Resolved,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates status inside a transaction and writes an audit log', async () => {
      ticketRepo.findOneBy.mockResolvedValue(baseTicket());

      const view = await service.updateTicket('admin-1', 'ticket-1', {
        status: SupportTicketStatus.Resolved,
        admin_note: 'Refund executed.',
      });

      expect(view.status).toBe(SupportTicketStatus.Resolved);
      expect(view.admin_note).toBe('Refund executed.');
      expect(txManager.save).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        txManager,
        'admin-1',
        'support_ticket.update',
        'support_ticket',
        'ticket-1',
        expect.objectContaining({
          previous_status: SupportTicketStatus.Open,
          new_status: SupportTicketStatus.Resolved,
          admin_note_set: true,
        }),
      );
    });
  });
});
