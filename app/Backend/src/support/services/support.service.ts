import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  SupportTicket,
  SupportTicketStatus,
} from '../entities/support-ticket.entity';
import { AuditLogService } from '../../admin/services/audit-log.service';
import { ErrorCode } from '../../common/dto/error-response.dto';
import {
  CreateSupportTicketDto,
  ListSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from '../dto/support-ticket.dto';

const DEFAULT_LIMIT = 20;

/** Wire shape per api_contract.md conventions (snake_case). */
export interface SupportTicketView {
  id: string;
  type: string;
  booking_reference: string | null;
  description: string;
  status: SupportTicketStatus;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
}

function toView(t: SupportTicket): SupportTicketView {
  return {
    id: t.id,
    type: t.type,
    booking_reference: t.bookingReference,
    description: t.description,
    status: t.status,
    admin_note: t.adminNote,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTicket(
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicketView> {
    const ticket = this.ticketRepo.create({
      userId,
      type: dto.type,
      bookingReference: dto.booking_reference?.trim().replace(/^#/, '') || null,
      description: dto.description.trim(),
    });
    const saved = await this.ticketRepo.save(ticket);
    return toView(saved);
  }

  /** The customer's own tickets, newest first. */
  async listMyTickets(userId: string): Promise<{ data: SupportTicketView[] }> {
    const tickets = await this.ticketRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { data: tickets.map(toView) };
  }

  /** Admin queue — all tickets, optional status filter, offset-paginated. */
  async listTickets(query: ListSupportTicketsQueryDto): Promise<{
    tickets: (SupportTicketView & {
      user_id: string;
      user_email: string | null;
    })[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;

    const [tickets, total] = await this.ticketRepo.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      tickets: tickets.map((t) => ({
        ...toView(t),
        user_id: t.userId,
        user_email: t.user?.email ?? null,
      })),
      total,
      limit,
      offset,
    };
  }

  /** Admin status/note update — audited like every other admin mutation. */
  async updateTicket(
    adminUserId: string,
    ticketId: string,
    dto: UpdateSupportTicketDto,
  ): Promise<SupportTicketView> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Support ticket not found.',
      });
    }

    const previousStatus = ticket.status;
    if (dto.status !== undefined) ticket.status = dto.status;
    if (dto.admin_note !== undefined) ticket.adminNote = dto.admin_note.trim();

    const saved = await this.entityManager.transaction(async (manager) => {
      const updated = await manager.save(SupportTicket, ticket);
      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'support_ticket.update',
        'support_ticket',
        ticket.id,
        {
          previous_status: previousStatus,
          new_status: updated.status,
          admin_note_set: dto.admin_note !== undefined,
        },
      );
      return updated;
    });

    return toView(saved);
  }
}
