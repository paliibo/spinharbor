import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@spinharbor/database';
import { FixedRng, SeededRng, type Rng } from '@spinharbor/engines';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RNG } from '../src/common/rng/rng.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { configureApp } from '../src/main';
import { LedgerService } from '../src/ledger/ledger.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  rng: Rng;
  http: () => request.Agent;
  close: () => Promise<void>;
}

/** Boots the full application against the test database with an injectable RNG. */
export async function createTestApp(rng: Rng = new SeededRng(1)): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RNG)
    .useValue(rng)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  // Listen on an ephemeral port so supertest never opens/closes the server per request.
  await app.listen(0);
  const prisma = app.get(PrismaService);
  return { app, prisma, rng, http: () => request.agent(app.getHttpServer()), close: () => app.close() };
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "IdempotencyRecord", "Notification", "RiskFlag", "PlayerLimit", "LoyaltyEvent", "LoyaltyAccount", "PlayerBonus", "Promotion", "BonusDefinition", "CrashBet", "CrashRound", "GameRoundTransaction", "GameRound", "GameSession", "PlayerRecentGame", "PlayerFavorite", "CasinoGameCategory", "CasinoGame", "GameCategory", "ProviderErrorLog", "CasinoProvider", "JournalLine", "JournalEntry", "Wallet", "LedgerAccount", "PlayerProfile", "UserSession", "User", "SystemSetting" CASCADE',
  );
}

/** Minimal catalogue: internal provider + the four playable games + bonus definitions. */
export async function seedBasics(ctx: TestContext) {
  await ctx.app.get(LedgerService).ensureHouseAccounts();
  const provider = await ctx.prisma.casinoProvider.create({ data: { code: 'spinharbor-studios', name: 'SpinHarbor Studios', integrationType: 'INTERNAL', status: 'OPERATIONAL' } });
  const stub = await ctx.prisma.casinoProvider.create({ data: { code: 'northwind-gaming', name: 'Northwind', integrationType: 'SEAMLESS_WALLET', status: 'NOT_CONFIGURED' } });
  const art = { palette: ['#000', '#111', '#222'], motif: 'reels' } as Prisma.InputJsonValue;
  const games = {} as Record<string, string>;
  for (const [slug, engine] of [
    ['harbor-reels', 'SLOTS'],
    ['harbor-dice', 'DICE'],
    ['harbor-roulette', 'ROULETTE'],
    ['harbor-crash', 'CRASH'],
  ] as const) {
    const g = await ctx.prisma.casinoGame.create({ data: { slug, name: slug, description: slug, providerId: provider.id, engine, artwork: art, minBetMinor: 100n, maxBetMinor: 50_000n } });
    games[slug] = g.id;
  }
  const preview = await ctx.prisma.casinoGame.create({ data: { slug: 'preview-game', name: 'Preview', description: 'x', providerId: stub.id, engine: 'DEMO_PREVIEW', artwork: art } });
  games['preview-game'] = preview.id;
  await ctx.prisma.bonusDefinition.createMany({
    data: [
      { code: 'WELCOME_2000', type: 'WELCOME', name: 'Welcome', description: 'w', amountMinor: 200_000n, wageringMultiplier: 5, maxClaimsPerUser: 1, validForHours: 168 },
      { code: 'DAILY_500', type: 'DAILY_REWARD', name: 'Daily', description: 'd', amountMinor: 50_000n, claimCooldownHours: 24, validForHours: 24 },
    ],
  });
  return { provider, stub, games };
}

export async function registerPlayer(ctx: TestContext, username = `p_${Math.random().toString(36).slice(2, 8)}`) {
  const agent = ctx.http();
  const res = await agent.post('/auth/register').send({ email: `${username}@test.dev`, username, password: 'Passw0rd!', acceptTerms: true });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user as { id: string; username: string }, accessToken: res.body.accessToken as string };
}

export async function createStaff(ctx: TestContext, role: 'SUPPORT' | 'OPERATOR' | 'ADMIN') {
  const username = `${role.toLowerCase()}_${Math.random().toString(36).slice(2, 6)}`;
  const { agent, user } = await registerPlayer(ctx, username);
  await ctx.prisma.user.update({ where: { id: user.id }, data: { role } });
  // re-login so the token carries the new role
  const res = await agent.post('/auth/login').send({ identifier: username, password: 'Passw0rd!' });
  return { agent, user, token: res.body.accessToken as string };
}

export async function openSession(agent: request.Agent, slug: string): Promise<string> {
  const res = await agent.post('/games/sessions').send({ gameSlug: slug });
  if (res.status !== 201) throw new Error(`session failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

export { FixedRng, SeededRng };
