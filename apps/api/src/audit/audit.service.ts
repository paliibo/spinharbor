import { Injectable } from '@nestjs/common';
import type { UserRole } from '@spinharbor/database';
import { PrismaService, Tx } from '../common/prisma/prisma.service';

export interface AuditInput {
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Append-only record of privileged / account actions. Never updated or deleted by the app. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(tx: Tx | null, input: AuditInput) {
    const db = tx ?? this.prisma;
    return db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata as any) ?? undefined,
        ipAddress: input.ip,
      },
    });
  }
}
