import { Injectable } from '@nestjs/common';
import type { GameArtwork, GameCategoryDto, GameDetailDto, GameListQuery, GameSummaryDto, Paginated, ProviderSummaryDto } from '@spinharbor/contracts';
import { Prisma } from '@spinharbor/database';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate, skipTake } from '../common/utils/pagination';

const gameInclude = {
  provider: { select: { id: true, code: true, name: true, status: true } },
  categories: { include: { category: { select: { slug: true, name: true } } } },
} satisfies Prisma.CasinoGameInclude;

type GameRow = Prisma.CasinoGameGetPayload<{ include: typeof gameInclude }>;

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  toSummary(g: GameRow, favoriteIds?: Set<string>): GameSummaryDto {
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      tagline: g.tagline,
      engine: g.engine,
      status: g.status,
      volatility: g.volatility,
      rtpLabel: g.rtpLabel,
      minBetMinor: Number(g.minBetMinor),
      maxBetMinor: Number(g.maxBetMinor),
      artwork: g.artwork as unknown as GameArtwork,
      isFeatured: g.isFeatured,
      isNew: g.isNew,
      playCount: g.playCount,
      releasedAt: g.releasedAt.toISOString(),
      provider: { id: g.provider.id, code: g.provider.code, name: g.provider.name },
      categories: g.categories.map((c) => ({ slug: c.category.slug, name: c.category.name })),
      isFavorite: favoriteIds ? favoriteIds.has(g.id) : undefined,
      playable: g.engine !== 'DEMO_PREVIEW' && g.status === 'ACTIVE' && g.provider.status === 'OPERATIONAL',
    };
  }

  private async favoriteIds(userId?: string): Promise<Set<string> | undefined> {
    if (!userId) return undefined;
    const favs = await this.prisma.playerFavorite.findMany({ where: { userId }, select: { gameId: true } });
    return new Set(favs.map((f) => f.gameId));
  }

  async list(q: GameListQuery, userId?: string, staff = false): Promise<Paginated<GameSummaryDto>> {
    const where: Prisma.CasinoGameWhereInput = {
      ...(q.includeDisabled && staff ? {} : { status: { in: ['ACTIVE', 'MAINTENANCE', 'COMING_SOON'] } }),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { tagline: { contains: q.search, mode: 'insensitive' } }, { provider: { name: { contains: q.search, mode: 'insensitive' } } }] } : {}),
      ...(q.category ? { categories: { some: { category: { slug: q.category } } } } : {}),
      ...(q.provider ? { provider: { code: q.provider } } : {}),
      ...(q.engine ? { engine: q.engine } : {}),
    };
    const orderBy: Prisma.CasinoGameOrderByWithRelationInput[] =
      q.sort === 'popular'
        ? [{ playCount: 'desc' }, { name: 'asc' }]
        : q.sort === 'newest'
          ? [{ releasedAt: 'desc' }]
          : q.sort === 'az'
            ? [{ name: 'asc' }]
            : q.sort === 'za'
              ? [{ name: 'desc' }]
              : [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { playCount: 'desc' }];
    const [total, rows, favs] = await Promise.all([
      this.prisma.casinoGame.count({ where }),
      this.prisma.casinoGame.findMany({ where, include: gameInclude, orderBy, ...skipTake(q.page, q.pageSize) }),
      this.favoriteIds(userId),
    ]);
    return paginate(
      rows.map((g) => this.toSummary(g, favs)),
      total,
      q.page,
      q.pageSize,
    );
  }

  async bySlug(slug: string, userId?: string): Promise<GameDetailDto> {
    const g = await this.prisma.casinoGame.findUnique({ where: { slug }, include: gameInclude });
    if (!g || g.status === 'DISABLED') throw Errors.notFound('Game');
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [favs, stats, biggest] = await Promise.all([
      this.favoriteIds(userId),
      this.prisma.gameRound.aggregate({ where: { gameId: g.id, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.gameRound.aggregate({ where: { gameId: g.id }, _max: { payoutMinor: true } }),
    ]);
    const players = await this.prisma.gameRound.findMany({ where: { gameId: g.id, createdAt: { gte: since } }, distinct: ['userId'], select: { userId: true } });
    return {
      ...this.toSummary(g, favs),
      description: g.description,
      stats: { rounds24h: stats._count._all, players24h: players.length, biggestWinMinor: Number(biggest._max.payoutMinor ?? 0n) },
    };
  }

  async categories(): Promise<GameCategoryDto[]> {
    const cats = await this.prisma.gameCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { games: { where: { game: { status: 'ACTIVE' } } } } } } });
    return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, icon: c.icon, sortOrder: c.sortOrder, gameCount: c._count.games }));
  }

  async providers(): Promise<ProviderSummaryDto[]> {
    const rows = await this.prisma.casinoProvider.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { games: true } } } });
    return rows.map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, integrationType: p.integrationType, gameCount: p._count.games }));
  }

  /** Home page sections in one round-trip-friendly payload. */
  async home(userId?: string) {
    const favs = await this.favoriteIds(userId);
    const base = { status: 'ACTIVE' as const };
    const [featured, popular, newest, recent] = await Promise.all([
      this.prisma.casinoGame.findMany({ where: { ...base, isFeatured: true }, include: gameInclude, orderBy: { sortOrder: 'asc' }, take: 8 }),
      this.prisma.casinoGame.findMany({ where: base, include: gameInclude, orderBy: { playCount: 'desc' }, take: 10 }),
      this.prisma.casinoGame.findMany({ where: base, include: gameInclude, orderBy: { releasedAt: 'desc' }, take: 10 }),
      userId ? this.recent(userId, 8) : Promise.resolve([]),
    ]);
    // Recommended: games in the categories the player plays most, excluding recently played.
    const recentIds = new Set(recent.map((g) => g.id));
    let recommended: GameRow[] = [];
    if (userId && recent.length) {
      const catSlugs = [...new Set(recent.flatMap((g) => g.categories.map((c) => c.category.slug)))];
      recommended = await this.prisma.casinoGame.findMany({
        where: { ...base, id: { notIn: [...recentIds] }, categories: { some: { category: { slug: { in: catSlugs } } } } },
        include: gameInclude,
        orderBy: { playCount: 'desc' },
        take: 8,
      });
    }
    if (recommended.length < 4) {
      const fill = await this.prisma.casinoGame.findMany({ where: { ...base, id: { notIn: [...recentIds, ...recommended.map((g) => g.id)] } }, include: gameInclude, orderBy: [{ volatility: 'desc' }, { playCount: 'desc' }], take: 8 - recommended.length });
      recommended = [...recommended, ...fill];
    }
    return {
      featured: featured.map((g) => this.toSummary(g, favs)),
      popular: popular.map((g) => this.toSummary(g, favs)),
      newest: newest.map((g) => this.toSummary(g, favs)),
      recent: recent.map((g) => this.toSummary(g, favs)),
      recommended: recommended.map((g) => this.toSummary(g, favs)),
    };
  }

  async recent(userId: string, take = 24): Promise<GameRow[]> {
    const rows = await this.prisma.playerRecentGame.findMany({ where: { userId, game: { status: 'ACTIVE' } }, orderBy: { lastPlayedAt: 'desc' }, take, include: { game: { include: gameInclude } } });
    return rows.map((r) => r.game);
  }

  async recentList(userId: string): Promise<GameSummaryDto[]> {
    const [rows, favs] = await Promise.all([this.recent(userId), this.favoriteIds(userId)]);
    return rows.map((g) => this.toSummary(g, favs));
  }

  async favorites(userId: string): Promise<GameSummaryDto[]> {
    const rows = await this.prisma.playerFavorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { game: { include: gameInclude } } });
    const ids = new Set(rows.map((r) => r.gameId));
    return rows.map((r) => this.toSummary(r.game, ids));
  }

  async toggleFavorite(userId: string, slug: string): Promise<{ isFavorite: boolean }> {
    const game = await this.prisma.casinoGame.findUnique({ where: { slug }, select: { id: true } });
    if (!game) throw Errors.notFound('Game');
    const existing = await this.prisma.playerFavorite.findUnique({ where: { userId_gameId: { userId, gameId: game.id } } });
    if (existing) {
      await this.prisma.playerFavorite.delete({ where: { userId_gameId: { userId, gameId: game.id } } });
      return { isFavorite: false };
    }
    await this.prisma.playerFavorite.create({ data: { userId, gameId: game.id } });
    return { isFavorite: true };
  }
}
