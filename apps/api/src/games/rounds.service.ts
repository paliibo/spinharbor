import { Injectable } from '@nestjs/common';
import type { GameRoundDto, Paginated, RoundListQuery } from '@spinharbor/contracts';
import { Prisma } from '@spinharbor/database';
import { AuthPrincipal, ROLE_RANK } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate, skipTake } from '../common/utils/pagination';
import { GameplayService } from './gameplay.service';

@Injectable()
export class RoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameplay: GameplayService,
  ) {}

  async listMine(userId: string, q: RoundListQuery): Promise<Paginated<GameRoundDto>> {
    const where: Prisma.GameRoundWhereInput = { userId, ...(q.engine ? { engine: q.engine } : {}), ...(q.gameSlug ? { game: { slug: q.gameSlug } } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.gameRound.count({ where }),
      this.prisma.gameRound.findMany({ where, include: { game: { select: { slug: true, name: true } } }, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize) }),
    ]);
    return paginate(rows.map((r) => this.gameplay.toRoundDto(r)), total, q.page, q.pageSize);
  }

  async get(p: AuthPrincipal, id: string) {
    const r = await this.prisma.gameRound.findUnique({ where: { id }, include: { game: { select: { slug: true, name: true } }, transactions: { include: { journalEntry: true } } } });
    if (!r || (r.userId !== p.id && ROLE_RANK[p.role] < ROLE_RANK.SUPPORT)) throw Errors.notFound('Round');
    return { ...this.gameplay.toRoundDto(r), transactions: r.transactions.map((t) => ({ id: t.id, type: t.type, amountMinor: Number(t.amountMinor), journalEntryId: t.journalEntryId, createdAt: t.createdAt.toISOString() })) };
  }

  /** Session statistics for the game UI (wins/losses/biggest win). */
  async sessionStats(userId: string, sessionId: string) {
    const rounds = await this.prisma.gameRound.findMany({ where: { sessionId, userId, status: 'SETTLED' }, select: { stakeMinor: true, payoutMinor: true } });
    const wins = rounds.filter((r) => r.payoutMinor > r.stakeMinor).length;
    const staked = rounds.reduce((a, r) => a + r.stakeMinor, 0n);
    const paid = rounds.reduce((a, r) => a + r.payoutMinor, 0n);
    const biggest = rounds.reduce((a, r) => (r.payoutMinor > a ? r.payoutMinor : a), 0n);
    return { rounds: rounds.length, wins, losses: rounds.length - wins, stakedMinor: Number(staked), paidMinor: Number(paid), netMinor: Number(paid - staked), biggestWinMinor: Number(biggest) };
  }
}
