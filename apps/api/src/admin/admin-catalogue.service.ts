import { Injectable } from '@nestjs/common';
import type { AdminCategorySchema, AdminProviderUpdateSchema, AdminUpdateBonusSchema, AdminUpdateGameSchema, AdminUpdatePromotionSchema } from '@spinharbor/contracts';
import { Prisma } from '@spinharbor/database';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CatalogueService } from '../casino/catalogue.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderRegistry } from '../providers/provider-registry.service';

@Injectable()
export class AdminCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalogue: CatalogueService,
    private readonly providers: ProviderRegistry,
  ) {}

  async games() {
    const rows = await this.prisma.casinoGame.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { provider: { select: { id: true, code: true, name: true, status: true } }, categories: { include: { category: { select: { slug: true, name: true } } } }, _count: { select: { rounds: true } } } });
    const since = new Date(Date.now() - 7 * 86_400_000);
    const weekly = await this.prisma.gameRound.groupBy({ by: ['gameId'], where: { createdAt: { gte: since }, status: 'SETTLED' }, _count: { _all: true }, _sum: { stakeMinor: true, payoutMinor: true } });
    const wk = new Map(weekly.map((w) => [w.gameId, w]));
    return rows.map((g) => ({
      ...this.catalogue.toSummary(g),
      description: g.description,
      sortOrder: g.sortOrder,
      totalRounds: g._count.rounds,
      rounds7d: wk.get(g.id)?._count._all ?? 0,
      staked7dMinor: Number(wk.get(g.id)?._sum.stakeMinor ?? 0n),
      ggr7dMinor: Number((wk.get(g.id)?._sum.stakeMinor ?? 0n) - (wk.get(g.id)?._sum.payoutMinor ?? 0n)),
    }));
  }

  async updateGame(actor: AuthPrincipal, id: string, input: z.infer<typeof AdminUpdateGameSchema>) {
    const game = await this.prisma.casinoGame.findUnique({ where: { id } });
    if (!game) throw Errors.notFound('Game');
    const { categorySlugs, ...data } = input;
    if (data.minBetMinor !== undefined && data.maxBetMinor !== undefined && data.minBetMinor > data.maxBetMinor) throw Errors.badRequest('BET_RANGE', 'minBet must be <= maxBet');
    await this.prisma.$transaction(async (tx) => {
      await tx.casinoGame.update({ where: { id }, data: { ...data, minBetMinor: data.minBetMinor === undefined ? undefined : BigInt(data.minBetMinor), maxBetMinor: data.maxBetMinor === undefined ? undefined : BigInt(data.maxBetMinor) } });
      if (categorySlugs) {
        const cats = await tx.gameCategory.findMany({ where: { slug: { in: categorySlugs } } });
        await tx.casinoGameCategory.deleteMany({ where: { gameId: id } });
        await tx.casinoGameCategory.createMany({ data: cats.map((c) => ({ gameId: id, categoryId: c.id })) });
      }
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: 'game.update', targetType: 'game', targetId: id, metadata: { changes: input, previousStatus: game.status } });
    });
    return (await this.games()).find((g) => g.id === id);
  }

  async upsertCategory(actor: AuthPrincipal, input: z.infer<typeof AdminCategorySchema>) {
    const cat = await this.prisma.gameCategory.upsert({ where: { slug: input.slug }, create: { ...input, sortOrder: input.sortOrder ?? 0 }, update: { ...input } });
    await this.audit.log(null, { actorId: actor.id, actorRole: actor.role, action: 'category.upsert', targetType: 'category', targetId: cat.id, metadata: input });
    return cat;
  }

  async deleteCategory(actor: AuthPrincipal, slug: string) {
    const cat = await this.prisma.gameCategory.findUnique({ where: { slug } });
    if (!cat) throw Errors.notFound('Category');
    await this.prisma.gameCategory.delete({ where: { slug } });
    await this.audit.log(null, { actorId: actor.id, actorRole: actor.role, action: 'category.delete', targetType: 'category', targetId: cat.id, metadata: { slug } });
    return { ok: true };
  }

  async providersDetail() {
    const rows = await this.prisma.casinoProvider.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { games: true, sessions: true } }, errors: { orderBy: { createdAt: 'desc' }, take: 10 } } });
    const adapters = new Set(this.providers.list());
    return rows.map((p) => ({ ...p, adapterLoaded: adapters.has(p.code), gameCount: p._count.games, sessionCount: p._count.sessions }));
  }

  async updateProvider(actor: AuthPrincipal, id: string, input: z.infer<typeof AdminProviderUpdateSchema>) {
    const p = await this.prisma.casinoProvider.findUnique({ where: { id } });
    if (!p) throw Errors.notFound('Provider');
    // Stub integrations cannot be switched to OPERATIONAL – there is nothing to connect to.
    if (input.status === 'OPERATIONAL' && p.integrationType !== 'INTERNAL') throw Errors.conflict('PROVIDER_STUB', 'External provider stubs cannot be enabled in this demo');
    const updated = await this.prisma.casinoProvider.update({ where: { id }, data: { status: input.status, config: input.config === undefined ? undefined : (input.config as Prisma.InputJsonValue), lastSyncAt: new Date() } });
    await this.audit.log(null, { actorId: actor.id, actorRole: actor.role, action: 'provider.update', targetType: 'provider', targetId: id, metadata: { ...input, previousStatus: p.status } });
    return updated;
  }

  async bonusDefinitions() {
    return this.prisma.bonusDefinition.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { claims: true } }, claims: { select: { amountMinor: true } } } }).then((rows) =>
      rows.map(({ claims, ...d }) => ({ ...d, claimCount: d._count.claims, totalAwardedMinor: Number(claims.reduce((a, c) => a + c.amountMinor, 0n)) })),
    );
  }

  async updateBonus(actor: AuthPrincipal, id: string, input: z.infer<typeof AdminUpdateBonusSchema>) {
    const d = await this.prisma.bonusDefinition.update({ where: { id }, data: { ...input, amountMinor: input.amountMinor === undefined ? undefined : BigInt(input.amountMinor), maxAmountMinor: input.maxAmountMinor === undefined ? undefined : input.maxAmountMinor === null ? null : BigInt(input.maxAmountMinor) } });
    await this.audit.log(null, { actorId: actor.id, actorRole: actor.role, action: 'bonus.update', targetType: 'bonus_definition', targetId: id, metadata: input });
    return d;
  }

  async promotions() {
    return this.prisma.promotion.findMany({ orderBy: { sortOrder: 'asc' }, include: { bonusDefinition: { select: { code: true, name: true } } } });
  }

  async updatePromotion(actor: AuthPrincipal, id: string, input: z.infer<typeof AdminUpdatePromotionSchema>) {
    const p = await this.prisma.promotion.update({ where: { id }, data: input });
    await this.audit.log(null, { actorId: actor.id, actorRole: actor.role, action: 'promotion.update', targetType: 'promotion', targetId: id, metadata: input });
    return p;
  }
}
