import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  /**
   * Writes a record into the audit_logs table.
   * Can be executed within a shared database transaction by passing the manager.
   */
  async logAction(
    manager: EntityManager,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> | null = null,
  ): Promise<AuditLog> {
    const auditLog = new AuditLog();
    auditLog.actorUserId = actorUserId;
    auditLog.action = action;
    auditLog.entityType = entityType;
    auditLog.entityId = entityId;
    auditLog.metadata = metadata;

    return manager.save(AuditLog, auditLog);
  }
}
