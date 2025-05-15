import { Injectable } from '@nestjs/common';
import type { BonusDefinitionDto, BonusEligibilityDto, PlayerBonusDto, PromotionDto } from '@spinharbor/contracts';
import { BonusDefinition, LoyaltyTier, Prisma } from '@spinharbor/database';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { FINANCIAL_TX, PrismaService, Tx } from '../common/prisma/prisma.service';
import { TIER_RANK } from '../loyalty/loyalty.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';

const CASHBACK_WINDOW_MS = 7 * 86_400_000;
const CASHBACK_MIN_AWARD = 100n; // 1 credit

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  nextClaimAt: Date | null;
  amountMinor: bigint;
  claimKey: string;
}

/**
 * Bonus model
 * - Cash awards (daily reward, cashback, milestones) go straight to the cash balance.
 * - Awards with a wagering multiplier (welcome bonus) go to the bonus balance; stakes consume cash
 *   first and bonus second, and wagering progress counts every real stake. When the last active
 *   wagering bonus completes, the whole bonus balance is released to cash (BONUS_RELEASE).
 * - Duplicate claims are prevented by the unique PlayerBonus.claimKey (checked inside the
 *   wallet-locked transaction, so concurrent claims cannot both succeed).
 * - Nothing here is withdrawable: all balances are demo credits.
 */
@Injectable()
export class BonusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly events: DomainEvents,
  ) {}

  toDefinitionDto(d: BonusDefinition): BonusDefinitionDto {
    return {
      id: d.id,
      code: d.code,
      type: d.type,
      name: d.name,
      description: d.description,
      amountMinor: Number(d.amountMinor),
      percentBp: d.percentBp,
      maxAmountMinor: d.maxAmountMinor === null ? null : Number(d.maxAmountMinor),
      wageringMultiplier: d.wageringMultiplier,
      claimCooldownHours: d.claimCooldownHours,
      maxClaimsPerUser: d.maxClaimsPerUser,
      validForHours: d.validForHours,
      requiredTier: d.requiredTier,
      isActive: d.isActive,
    };
  }

  private toPlayerBonusDto(b: Prisma.PlayerBonusGetPayload<{ include: { definition: true } }>): PlayerBonusDto {
    return {
      id: b.id,
      definition: { code: b.definition.code, name: b.definition.name, type: b.definition.type },
      status: b.status,
      amountMinor: Number(b.amountMinor),
      wageringRequiredMinor: Number(b.wageringRequiredMinor),
      wageringProgressMinor: Number(b.wageringProgressMinor),
      claimedAt: b.claimedAt.toISOString(),
      expiresAt: b.expiresAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    };
  }

  private async evaluate(db: Tx | PrismaService, userId: string, def: BonusDefinition, now = new Date()): Promise<Eligibility> {
    const claims = await db.playerBonus.findMany({ where: { userId, definitionId: def.id }, orderBy: { claimedAt: 'desc' } });
    const last = claims[0];
    const base = { eligible: false, nextClaimAt: null as Date | null, amountMinor: def.amountMinor };
    if (!def.isActive) return { ...base, reason: 'This bonus is not active', claimKey: '' };
    if (def.maxClaimsPerUser !== null && claims.length >= def.maxClaimsPerUser) return { ...base, reason: 'Already claimed', claimKey: '' };
    if (def.requiredTier) {
      const loyalty = await db.loyaltyAccount.findUnique({ where: { userId } });
      const tier: LoyaltyTier = loyalty?.tier ?? 'BRONZE';
      if (TIER_RANK[tier] < TIER_RANK[def.requiredTier]) return { ...base, reason: `Requires ${def.requiredTier.toLowerCase()} tier`, claimKey: '' };
    }
    if (def.claimCooldownHours && last) {
      const next = new Date(last.claimedAt.getTime() + def.claimCooldownHours * 3600 * 1000);
      if (next > now) return { ...base, reason: 'Cooldown active', nextClaimAt: next, claimKey: '' };
    }
    let claimKey = `${userId}:${def.code}`;
    let amount = def.amountMinor;
    if (def.type === 'DAILY_REWARD') claimKey += `:${now.toISOString().slice(0, 10)}`;
    if (def.type === 'CASHBACK') {
      const since = last ? new Date(Math.max(last.claimedAt.getTime(), now.getTime() - CASHBACK_WINDOW_MS)) : new Date(now.getTime() - CASHBACK_WINDOW_MS);
      const agg = await db.gameRound.aggregate({ where: { userId, status: 'SETTLED', createdAt: { gte: since } }, _sum: { stakeMinor: true, payoutMinor: true } });
      const loss = (agg._sum.stakeMinor ?? 0n) - (agg._sum.payoutMinor ?? 0n);
      amount = loss > 0n ? (loss * BigInt(def.percentBp ?? 0)) / 10_000n : 0n;
      if (def.maxAmountMinor !== null && amount > def.maxAmountMinor) amount = def.maxAmountMinor;
      claimKey += `:${since.toISOString().slice(0, 10)}`;
      if (amount < CASHBACK_MIN_AWARD) return { ...base, amountMinor: amount, reason: 'No eligible net losses in the last 7 days', claimKey };
    }
    return { eligible: true, reason: null, nextClaimAt: null, amountMinor: amount, claimKey };
  }

  async eligibility(userId: string): Promise<BonusEligibilityDto[]> {
    const defs = await this.prisma.bonusDefinition.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    const out: BonusEligibilityDto[] = [];
    for (const def of defs) {
      const e = await this.evaluate(this.prisma, userId, def);
      out.push({ definition: this.toDefinitionDto(def), eligible: e.eligible, reason: e.reason, nextClaimAt: e.nextClaimAt?.toISOString() ?? null, previewAmountMinor: Number(e.amountMinor) });
    }
    return out;
  }

  async claim(p: AuthPrincipal, code: string): Promise<{ bonus: PlayerBonusDto; wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number } }> {
    const def = await this.prisma.bonusDefinition.findUnique({ where: { code } });
    if (!def || !def.isActive) throw Errors.notFound('Bonus');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.users.assertCanPlay(tx, p.id);
      const locked = await this.wallet.lockWallet(tx, p.id);
      const e = await this.evaluate(tx, p.id, def);
      if (!e.eligible) throw Errors.conflict('BONUS_NOT_ELIGIBLE', e.reason ?? 'Not eligible');
      const toBonusBalance = def.wageringMultiplier > 0;
      const countsAsTopup = def.type === 'DAILY_REWARD';
      if (!toBonusBalance && countsAsTopup) await this.wallet.enforceTopupLimit(tx, p.id, e.amountMinor);

      let bonus;
      try {
        bonus = await tx.playerBonus.create({
          data: {
            userId: p.id,
            definitionId: def.id,
            amountMinor: e.amountMinor,
            wageringRequiredMinor: toBonusBalance ? e.amountMinor * BigInt(def.wageringMultiplier) : 0n,
            claimKey: e.claimKey,
            expiresAt: new Date(Date.now() + def.validForHours * 3600 * 1000),
            status: toBonusBalance ? 'ACTIVE' : 'COMPLETED',
            completedAt: toBonusBalance ? null : new Date(),
          },
          include: { definition: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw Errors.conflict('DUPLICATE_CLAIM', 'This bonus was already claimed');
        throw err;
      }
      const movement = await this.wallet.applyMovement(
        tx,
        {
          userId: p.id,
          type: 'BONUS_AWARD',
          description: `${def.name}`,
          idempotencyKey: `bonus:${bonus.id}`,
          referenceType: 'player_bonus',
          referenceId: bonus.id,
          cashDeltaMinor: toBonusBalance ? 0n : e.amountMinor,
          bonusDeltaMinor: toBonusBalance ? e.amountMinor : 0n,
          houseAccount: 'HOUSE_BONUS',
          metadata: { code: def.code, countsAsTopup },
        },
        locked,
      );
      await tx.playerBonus.update({ where: { id: bonus.id }, data: { journalEntryId: movement.entry?.id } });
      await this.audit.log(tx, { actorId: p.id, actorRole: p.role, action: 'bonus.claim', targetType: 'player_bonus', targetId: bonus.id, metadata: { code: def.code, amountMinor: Number(e.amountMinor) } });
      return { bonus, wallet: movement.wallet };
    }, FINANCIAL_TX);
    this.wallet.publishWallet(result.wallet, 'bonus_award');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.id }, select: { username: true } });
    this.events.publish('bonus.claimed', { userId: p.id, username: user.username, bonusName: def.name, amountMinor: result.bonus.amountMinor });
    return {
      bonus: this.toPlayerBonusDto(result.bonus),
      wallet: { balanceMinor: Number(result.wallet.balanceMinor), bonusBalanceMinor: Number(result.wallet.bonusBalanceMinor), version: result.wallet.version },
    };
  }

  /** Called inside the gameplay transaction after a stake was debited. */
  async progressWagering(tx: Tx, userId: string, stakeMinor: bigint, roundId: string) {
    const active = await tx.playerBonus.findMany({ where: { userId, status: 'ACTIVE', wageringRequiredMinor: { gt: 0n } }, orderBy: { claimedAt: 'asc' } });
    if (active.length === 0) return;
    let remaining = stakeMinor;
    let completedAny = false;
    for (const b of active) {
      if (remaining <= 0n) break;
      const need = b.wageringRequiredMinor - b.wageringProgressMinor;
      const apply = remaining < need ? remaining : need;
      remaining -= apply;
      const done = b.wageringProgressMinor + apply >= b.wageringRequiredMinor;
      await tx.playerBonus.update({ where: { id: b.id }, data: { wageringProgressMinor: { increment: apply }, ...(done ? { status: 'COMPLETED', completedAt: new Date() } : {}) } });
      if (done) completedAny = true;
    }
    if (!completedAny) return;
    const stillActive = await tx.playerBonus.count({ where: { userId, status: 'ACTIVE', wageringRequiredMinor: { gt: 0n } } });
    if (stillActive > 0) return;
    const w = await this.wallet.lockWallet(tx, userId);
    if (w.bonusBalanceMinor > 0n) {
      await this.wallet.applyMovement(
        tx,
        {
          userId,
          type: 'BONUS_RELEASE',
          description: 'Wagering complete – bonus funds released to cash',
          idempotencyKey: `bonus-release:${roundId}`,
          referenceType: 'game_round',
          referenceId: roundId,
          cashDeltaMinor: w.bonusBalanceMinor,
          bonusDeltaMinor: -w.bonusBalanceMinor,
          houseAccount: 'HOUSE_BONUS',
        },
        w,
      );
    }
  }

  /** Background job: expire ACTIVE bonuses and forfeit remaining bonus funds. */
  async expireBonuses(): Promise<number> {
    const expired = await this.prisma.playerBonus.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } }, select: { id: true, userId: true } });
    for (const b of expired) {
      const r = await this.prisma.$transaction(async (tx) => {
        const upd = await tx.playerBonus.updateMany({ where: { id: b.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
        if (upd.count === 0) return null;
        const stillActive = await tx.playerBonus.count({ where: { userId: b.userId, status: 'ACTIVE', wageringRequiredMinor: { gt: 0n } } });
        if (stillActive > 0) return null;
        const w = await this.wallet.lockWallet(tx, b.userId);
        if (w.bonusBalanceMinor <= 0n) return null;
        const m = await this.wallet.applyMovement(
          tx,
          { userId: b.userId, type: 'BONUS_FORFEIT', description: 'Bonus expired – remaining bonus funds forfeited', idempotencyKey: `bonus-forfeit:${b.id}`, referenceType: 'player_bonus', referenceId: b.id, cashDeltaMinor: 0n, bonusDeltaMinor: -w.bonusBalanceMinor, houseAccount: 'HOUSE_BONUS' },
          w,
        );
        return m.wallet;
      });
      if (r) this.wallet.publishWallet(r, 'bonus_forfeit');
    }
    return expired.length;
  }

  async history(userId: string): Promise<PlayerBonusDto[]> {
    const rows = await this.prisma.playerBonus.findMany({ where: { userId }, include: { definition: true }, orderBy: { claimedAt: 'desc' }, take: 100 });
    return rows.map((b) => this.toPlayerBonusDto(b));
  }

  async promotions(): Promise<PromotionDto[]> {
    const now = new Date();
    const rows = await this.prisma.promotion.findMany({ where: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] }, orderBy: { sortOrder: 'asc' }, include: { bonusDefinition: { select: { code: true } } } });
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      description: p.description,
      artwork: p.artwork as PromotionDto['artwork'],
      ctaLabel: p.ctaLabel,
      bonusCode: p.bonusDefinition?.code ?? null,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt?.toISOString() ?? null,
      isActive: p.isActive,
    }));
  }
}
