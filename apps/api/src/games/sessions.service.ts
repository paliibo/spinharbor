import { Injectable } from '@nestjs/common';
import type { GameSessionDto } from '@spinharbor/contracts';
import { CRASH_CONFIG, DICE_CONFIG, ROULETTE_CONFIG, SLOTS_CONFIG } from '@spinharbor/engines';
import type { GameEngine, GameSession } from '@spinharbor/database';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { UsersService } from '../users/users.service';

const SESSION_IDLE_MS = 12 * 3600 * 1000;

export function engineConfig(engine: GameEngine) {
  switch (engine) {
    case 'SLOTS':
      return SLOTS_CONFIG;
    case 'DICE':
      return DICE_CONFIG;
    case 'ROULETTE':
      return ROULETTE_CONFIG;
    case 'CRASH':
      return CRASH_CONFIG;
    default:
      return {};
  }
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly users: UsersService,
    private readonly events: DomainEvents,
  ) {}

  toDto(s: GameSession & { game: { slug: string; engine: GameEngine } }): GameSessionDto {
    return {
      id: s.id,
      gameId: s.gameId,
      gameSlug: s.game.slug,
      engine: s.game.engine,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      roundsCount: s.roundsCount,
      totalStakedMinor: Number(s.totalStakedMinor),
      totalPaidMinor: Number(s.totalPaidMinor),
      config: engineConfig(s.game.engine) as GameSessionDto['config'],
    };
  }

  /** Opens (or resumes) the player's session for a game through its provider adapter. */
  async create(p: AuthPrincipal, gameSlug: string): Promise<GameSessionDto> {
    const game = await this.prisma.casinoGame.findUnique({ where: { slug: gameSlug }, include: { provider: true } });
    if (!game) throw Errors.notFound('Game');
    if (game.status !== 'ACTIVE' || game.engine === 'DEMO_PREVIEW') throw Errors.gameUnavailable(game.slug);
    const maintenance = await this.prisma.systemSetting.findUnique({ where: { key: 'maintenanceMode' } });
    if (maintenance?.value === true) throw Errors.conflict('MAINTENANCE', 'The casino is in maintenance mode');

    const session = await this.prisma.$transaction(async (tx) => {
      await this.users.assertCanPlay(tx, p.id);
      const existing = await tx.gameSession.findFirst({ where: { userId: p.id, gameId: game.id, status: 'ACTIVE' }, include: { game: true }, orderBy: { startedAt: 'desc' } });
      if (existing && Date.now() - existing.lastActivityAt.getTime() < SESSION_IDLE_MS) return existing;
      if (existing) await tx.gameSession.update({ where: { id: existing.id }, data: { status: 'EXPIRED', closedAt: new Date() } });
      const provider = await this.providers.resolve(game.provider.code);
      const id = crypto.randomUUID();
      const ps = await provider.createSession({ userId: p.id, game, platformSessionId: id });
      return tx.gameSession.create({ data: { id, userId: p.id, gameId: game.id, providerId: game.providerId, token: ps.token }, include: { game: true } });
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.id }, select: { username: true } });
    this.events.publish('session.started', { userId: p.id, username: user.username, gameName: game.name, sessionId: session.id });
    return this.toDto(session);
  }

  async get(p: AuthPrincipal, id: string): Promise<GameSessionDto> {
    const s = await this.prisma.gameSession.findUnique({ where: { id }, include: { game: true } });
    if (!s || s.userId !== p.id) throw Errors.notFound('Session');
    return this.toDto(s);
  }

  async close(p: AuthPrincipal, id: string): Promise<GameSessionDto> {
    const s = await this.prisma.gameSession.findUnique({ where: { id }, include: { game: true, provider: true } });
    if (!s || s.userId !== p.id) throw Errors.notFound('Session');
    if (s.status !== 'ACTIVE') return this.toDto(s);
    const provider = await this.providers.resolve(s.provider.code).catch(() => null);
    await provider?.closeSession(s.token);
    const updated = await this.prisma.gameSession.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() }, include: { game: true } });
    return this.toDto(updated);
  }

  /** Background job: expire idle sessions. */
  async expireIdle(): Promise<number> {
    const r = await this.prisma.gameSession.updateMany({ where: { status: 'ACTIVE', lastActivityAt: { lt: new Date(Date.now() - SESSION_IDLE_MS) } }, data: { status: 'EXPIRED', closedAt: new Date() } });
    return r.count;
  }
}
