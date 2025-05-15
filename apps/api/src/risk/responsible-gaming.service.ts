import { Injectable } from '@nestjs/common';
import type { ResponsibleGamingDto, SetLimitInput } from '@spinharbor/contracts';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { PrismaService } from '../common/prisma/prisma.service';
import { LimitsService } from './limits.service';

@Injectable()
export class ResponsibleGamingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: LimitsService,
    private readonly audit: AuditService,
    private readonly events: DomainEvents,
  ) {}

  async status(userId: string): Promise<ResponsibleGamingDto> {
    const [user, limits] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
      this.limits.usage(userId),
    ]);
    return { status: user.status, statusUntil: user.statusUntil?.toISOString() ?? null, limits, sessionReminderMinutes: user.profile?.sessionReminderMinutes ?? 60 };
  }

  async setLimit(p: AuthPrincipal, input: SetLimitInput) {
    const existing = await this.prisma.playerLimit.findUnique({ where: { userId_type: { userId: p.id, type: input.type } } });
    // Loosening or removing a limit takes effect only after a 24h cool-down in real products;
    // in this demo it is immediate but audited.
    await this.limits.setLimit(p.id, input.type, input.value === null ? null : BigInt(input.value));
    await this.audit.log(null, { actorId: p.id, actorRole: p.role, action: 'rg.limit_set', targetType: 'user', targetId: p.id, metadata: { type: input.type, value: input.value, previous: existing ? Number(existing.value) : null } });
    return this.status(p.id);
  }

  async coolingOff(p: AuthPrincipal, hours: number) {
    const until = new Date(Date.now() + hours * 3600 * 1000);
    await this.applyRestriction(p, 'COOLING_OFF', until, `Voluntary cooling-off for ${hours}h`);
    return this.status(p.id);
  }

  async selfExclude(p: AuthPrincipal, days: number | null) {
    const until = days ? new Date(Date.now() + days * 86_400_000) : null;
    await this.applyRestriction(p, 'SELF_EXCLUDED', until, days ? `Self-exclusion for ${days} days` : 'Indefinite self-exclusion');
    return this.status(p.id);
  }

  private async applyRestriction(p: AuthPrincipal, status: 'COOLING_OFF' | 'SELF_EXCLUDED', until: Date | null, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: p.id } });
      if (user.status === 'SUSPENDED' || user.status === 'CLOSED') throw Errors.accountRestricted(user.status, null);
      if (user.status === 'SELF_EXCLUDED') throw Errors.conflict('ALREADY_EXCLUDED', 'You are already self-excluded');
      await tx.user.update({ where: { id: p.id }, data: { status, statusUntil: until, statusReason: reason } });
      await tx.gameSession.updateMany({ where: { userId: p.id, status: 'ACTIVE' }, data: { status: 'CLOSED', closedAt: new Date() } });
      await this.audit.log(tx, { actorId: p.id, actorRole: p.role, action: status === 'COOLING_OFF' ? 'rg.cooling_off' : 'rg.self_exclude', targetType: 'user', targetId: p.id, metadata: { until, reason } });
    });
    this.events.publish('account.status', { userId: p.id, status, statusUntil: until, reason });
  }
}
