import { Injectable } from '@nestjs/common';
import type { AdminSettingsSchema } from '@spinharbor/contracts';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { PrismaService } from '../common/prisma/prisma.service';

export const SETTING_DEFAULTS: Record<string, { value: unknown; description: string }> = {
  maintenanceMode: { value: false, description: 'Blocks new game sessions when enabled' },
  maxBetMinor: { value: 1_000_000, description: 'Global max stake per round (minor units)' },
  crashHouseEdgeBp: { value: 100, description: 'House edge applied to new crash rounds (basis points)' },
  dailyTopupLimitMinor: { value: 5_000_000, description: 'Max demo credits a player can top up per day' },
  sessionReminderDefaultMinutes: { value: 60, description: 'Default session reminder interval' },
};

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async all() {
    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r]));
    return Object.entries(SETTING_DEFAULTS).map(([key, def]) => ({ key, value: map.get(key)?.value ?? def.value, description: def.description, updatedAt: map.get(key)?.updatedAt?.toISOString() ?? null, isDefault: !map.has(key) }));
  }

  async update(actor: AuthPrincipal, input: z.infer<typeof AdminSettingsSchema>) {
    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        await tx.systemSetting.upsert({ where: { key }, create: { key, value: value as any, description: SETTING_DEFAULTS[key]?.description, updatedById: actor.id }, update: { value: value as any, updatedById: actor.id } });
      }
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: 'settings.update', targetType: 'settings', metadata: input });
    });
    return this.all();
  }
}
