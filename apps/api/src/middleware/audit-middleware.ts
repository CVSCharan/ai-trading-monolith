import { db } from '../db';
import { auditLogs } from '../db/schema';
import { logger } from '../logger';

export interface AuditEventInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Append an immutable audit log record to `audit_logs` (INSERT-only).
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      newValues: input.details ?? {},
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action, entityType: input.entityType }, 'Failed to write audit log');
  }
}
