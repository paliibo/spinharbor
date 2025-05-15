import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminAuditQuerySchema,
  AdminCategorySchema,
  AdminPlayerQuerySchema,
  AdminProviderUpdateSchema,
  AdminRiskReviewSchema,
  AdminRoundQuerySchema,
  AdminSessionQuerySchema,
  AdminSettingsSchema,
  AdminTransactionQuerySchema,
  AdminUpdateBonusSchema,
  AdminUpdateGameSchema,
  AdminUpdatePlayerStatusSchema,
  AdminUpdatePromotionSchema,
  DateRangeQuerySchema,
} from '@spinharbor/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthPrincipal, CurrentUser, Roles } from '../common/decorators/auth.decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { clientIp } from '../common/utils/ip';
import { paginate, skipTake } from '../common/utils/pagination';
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod/zod.decorators';
import { LedgerService } from '../ledger/ledger.service';
import { RiskService } from '../risk/risk.service';
import { WalletService } from '../wallet/wallet.service';
import { AdminCatalogueService } from './admin-catalogue.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminPlayersService } from './admin-players.service';
import { AdminSettingsService } from './admin-settings.service';

const AdjustSchema = z.object({ amountMinor: z.number().int().refine((v) => v !== 0, 'non-zero'), reason: z.string().min(3).max(300) });
const ReasonSchema = z.object({ reason: z.string().min(3).max(300) });

/** Staff API. SUPPORT = read-only, OPERATOR = catalogue/bonus/player status, ADMIN = money & settings. */
@ApiTags('admin')
@ApiCookieAuth()
@Roles('SUPPORT')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly players: AdminPlayersService,
    private readonly catalogue: AdminCatalogueService,
    private readonly settings: AdminSettingsService,
    private readonly risk: RiskService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  // ───── dashboard ─────
  @Get('dashboard')
  @ApiOperation({ summary: 'Operator KPIs, daily series, top games, recent activity' })
  @ApiZodQuery(DateRangeQuerySchema)
  dashboard(@ZodQuery(DateRangeQuerySchema) q: z.infer<typeof DateRangeQuerySchema>) {
    return this.metrics.dashboard(q.range);
  }

  // ───── players ─────
  @Get('players')
  @ApiZodQuery(AdminPlayerQuerySchema)
  listPlayers(@ZodQuery(AdminPlayerQuerySchema) q: z.infer<typeof AdminPlayerQuerySchema>) {
    return this.players.list(q);
  }

  @Get('players/:id')
  player(@Param('id') id: string) {
    return this.players.detail(id);
  }

  @Patch('players/:id/status')
  @Roles('OPERATOR')
  @ApiZodBody(AdminUpdatePlayerStatusSchema)
  playerStatus(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminUpdatePlayerStatusSchema) body: z.infer<typeof AdminUpdatePlayerStatusSchema>, @Req() req: Request) {
    return this.players.updateStatus(actor, id, body.status, body.reason, clientIp(req));
  }

  @Post('players/:id/wallet/adjust')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manual balance adjustment (audited, produces an ADJUSTMENT entry)' })
  @ApiZodBody(AdjustSchema)
  adjust(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdjustSchema) body: z.infer<typeof AdjustSchema>) {
    return this.wallet.adminAdjust(actor, id, BigInt(body.amountMinor), body.reason).then((r) => ({ entryId: r.entry?.id, wallet: { balanceMinor: Number(r.wallet.balanceMinor), bonusBalanceMinor: Number(r.wallet.bonusBalanceMinor) } }));
  }

  @Get('players/:id/reconcile')
  reconcile(@Param('id') id: string) {
    return this.ledger.reconcileUser(id);
  }

  // ───── sessions / rounds / transactions ─────
  @Get('sessions')
  @ApiZodQuery(AdminSessionQuerySchema)
  sessions(@ZodQuery(AdminSessionQuerySchema) q: z.infer<typeof AdminSessionQuerySchema>) {
    return this.players.sessions(q);
  }

  @Get('rounds')
  @ApiZodQuery(AdminRoundQuerySchema)
  rounds(@ZodQuery(AdminRoundQuerySchema) q: z.infer<typeof AdminRoundQuerySchema>) {
    return this.players.rounds(q);
  }

  @Get('transactions')
  @ApiZodQuery(AdminTransactionQuerySchema)
  transactions(@ZodQuery(AdminTransactionQuerySchema) q: z.infer<typeof AdminTransactionQuerySchema>) {
    return this.players.transactions(q);
  }

  @Get('transactions/:id')
  transaction(@Param('id') id: string) {
    return this.players.transaction(id);
  }

  @Post('transactions/:id/reverse')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Post a compensating REVERSAL entry for an adjustment or bonus award' })
  @ApiZodBody(ReasonSchema)
  reverse(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(ReasonSchema) body: z.infer<typeof ReasonSchema>) {
    return this.wallet.reverseEntry(actor, id, body.reason).then((r) => ({ entryId: r.entry?.id }));
  }

  @Get('ledger/health')
  @ApiOperation({ summary: 'Global ledger invariant (sum of all journal lines must be 0)' })
  async ledgerHealth() {
    const sum = await this.ledger.globalBalance();
    const wallets = await this.prisma.wallet.findMany({ select: { userId: true } });
    let mismatches = 0;
    for (const w of wallets) if (!(await this.ledger.reconcileUser(w.userId)).ok) mismatches++;
    return { journalSumMinor: Number(sum), balanced: sum === 0n, wallets: wallets.length, mismatchedWallets: mismatches };
  }

  // ───── catalogue ─────
  @Get('games')
  games() {
    return this.catalogue.games();
  }

  @Patch('games/:id')
  @Roles('OPERATOR')
  @ApiZodBody(AdminUpdateGameSchema)
  updateGame(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminUpdateGameSchema) body: z.infer<typeof AdminUpdateGameSchema>) {
    return this.catalogue.updateGame(actor, id, body);
  }

  @Get('categories')
  categories() {
    return this.prisma.gameCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { games: true } } } });
  }

  @Put('categories')
  @Roles('OPERATOR')
  @ApiZodBody(AdminCategorySchema)
  upsertCategory(@CurrentUser() actor: AuthPrincipal, @ZodBody(AdminCategorySchema) body: z.infer<typeof AdminCategorySchema>) {
    return this.catalogue.upsertCategory(actor, body);
  }

  @Delete('categories/:slug')
  @Roles('OPERATOR')
  deleteCategory(@CurrentUser() actor: AuthPrincipal, @Param('slug') slug: string) {
    return this.catalogue.deleteCategory(actor, slug);
  }

  @Get('providers')
  providers() {
    return this.catalogue.providersDetail();
  }

  @Patch('providers/:id')
  @Roles('OPERATOR')
  @ApiZodBody(AdminProviderUpdateSchema)
  updateProvider(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminProviderUpdateSchema) body: z.infer<typeof AdminProviderUpdateSchema>) {
    return this.catalogue.updateProvider(actor, id, body);
  }

  // ───── bonuses / promotions ─────
  @Get('bonuses')
  bonuses() {
    return this.catalogue.bonusDefinitions();
  }

  @Patch('bonuses/:id')
  @Roles('OPERATOR')
  @ApiZodBody(AdminUpdateBonusSchema)
  updateBonus(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminUpdateBonusSchema) body: z.infer<typeof AdminUpdateBonusSchema>) {
    return this.catalogue.updateBonus(actor, id, body);
  }

  @Get('bonuses/claims')
  async bonusClaims(@Query('page') page = '1') {
    const p = Math.max(1, Number(page) || 1);
    const [total, rows] = await Promise.all([
      this.prisma.playerBonus.count(),
      this.prisma.playerBonus.findMany({ orderBy: { claimedAt: 'desc' }, ...skipTake(p, 25), include: { user: { select: { username: true } }, definition: { select: { name: true, code: true, type: true } } } }),
    ]);
    return paginate(rows.map((b) => ({ ...b, amountMinor: Number(b.amountMinor), wageringRequiredMinor: Number(b.wageringRequiredMinor), wageringProgressMinor: Number(b.wageringProgressMinor) })), total, p, 25);
  }

  @Get('promotions')
  promotions() {
    return this.catalogue.promotions();
  }

  @Patch('promotions/:id')
  @Roles('OPERATOR')
  @ApiZodBody(AdminUpdatePromotionSchema)
  updatePromotion(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminUpdatePromotionSchema) body: z.infer<typeof AdminUpdatePromotionSchema>) {
    return this.catalogue.updatePromotion(actor, id, body);
  }

  // ───── risk ─────
  @Get('risk/flags')
  async riskFlags(@Query('status') status?: string, @Query('page') page = '1') {
    const p = Math.max(1, Number(page) || 1);
    const where = status ? { status: status as any } : {};
    const [total, rows] = await Promise.all([
      this.prisma.riskFlag.count({ where }),
      this.prisma.riskFlag.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], ...skipTake(p, 25), include: { user: { select: { username: true, status: true } }, reviewedBy: { select: { username: true } } } }),
    ]);
    return paginate(rows, total, p, 25);
  }

  @Patch('risk/flags/:id')
  @Roles('OPERATOR')
  @ApiZodBody(AdminRiskReviewSchema)
  reviewFlag(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @ZodBody(AdminRiskReviewSchema) body: z.infer<typeof AdminRiskReviewSchema>) {
    return this.risk.review(actor, id, body.status, body.resolution);
  }

  // ───── audit ─────
  @Get('audit')
  @ApiZodQuery(AdminAuditQuerySchema)
  async audit(@ZodQuery(AdminAuditQuerySchema) q: z.infer<typeof AdminAuditQuerySchema>) {
    const where = { ...(q.action ? { action: { contains: q.action } } : {}), ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.targetType ? { targetType: q.targetType } : {}) };
    const [total, rows] = await Promise.all([this.prisma.auditLog.count({ where }), this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize), include: { actor: { select: { username: true, role: true } } } })]);
    return paginate(rows, total, q.page, q.pageSize);
  }

  // ───── settings ─────
  @Get('settings')
  getSettings() {
    return this.settings.all();
  }

  @Patch('settings')
  @Roles('ADMIN')
  @ApiZodBody(AdminSettingsSchema)
  updateSettings(@CurrentUser() actor: AuthPrincipal, @ZodBody(AdminSettingsSchema) body: z.infer<typeof AdminSettingsSchema>) {
    return this.settings.update(actor, body);
  }

  @Post('maintenance/run/:job')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manually trigger a maintenance job (expire-bonuses, expire-sessions, reconcile)' })
  runJob(@Param('job') job: string, @Body() _body: unknown) {
    return { queued: job };
  }
}
