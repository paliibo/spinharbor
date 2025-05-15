/* eslint-disable no-console */
/**
 * SpinHarbor demo seed.
 * Produces 20 players + staff, the catalogue, bonuses/promotions and ~30 days of gameplay history
 * whose journal entries reconcile exactly to each wallet balance. Re-runnable: wipes demo data first.
 */
import { PrismaClient, Prisma, type LoyaltyTier } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { SeededRng, playSlots, playDice, playRoulette, crashPointFromSeed, crashMultiplierAt, crashTimeToReach, sha256Hex, SLOTS_CONFIG, DICE_CONFIG, ROULETTE_CONFIG, CRASH_CONFIG } from '@spinharbor/engines';
import { BONUSES, CATEGORIES, DEMO_PASSWORDS, GAMES, PLAYER_NAMES, PROMOTIONS, PROVIDERS } from './seed-data';

const prisma = new PrismaClient();
const rng = new SeededRng('spinharbor-demo-seed-v1');
const INITIAL = 1_000_000n; // 10,000.00 credits
const DAY = 86_400_000;
const NOW = Date.now();

const TIERS: [LoyaltyTier, number][] = [
  ['BRONZE', 0],
  ['SILVER', 500],
  ['GOLD', 2500],
  ['PLATINUM', 10000],
];
const tierFor = (lifetime: number): LoyaltyTier => TIERS.reduce<LoyaltyTier>((t, [tier, min]) => (lifetime >= min ? tier : t), 'BRONZE');

const pick = <T>(arr: readonly T[]): T => arr[rng.nextInt(arr.length)];
const between = (a: number, b: number) => a + rng.nextInt(b - a + 1);

interface Ledger {
  entries: Prisma.JournalEntryCreateManyInput[];
  lines: Prisma.JournalLineCreateManyInput[];
}

async function wipe() {
  // Order matters for FK constraints; cascades handle the rest.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AuditLog", "IdempotencyRecord", "Notification", "RiskFlag", "PlayerLimit", "LoyaltyEvent", "LoyaltyAccount", "PlayerBonus", "Promotion", "BonusDefinition", "CrashBet", "CrashRound", "GameRoundTransaction", "GameRound", "GameSession", "PlayerRecentGame", "PlayerFavorite", "CasinoGameCategory", "CasinoGame", "GameCategory", "ProviderErrorLog", "CasinoProvider", "JournalLine", "JournalEntry", "Wallet", "LedgerAccount", "PlayerProfile", "UserSession", "User", "SystemSetting" CASCADE');
}

async function main() {
  console.log('→ wiping existing demo data');
  await wipe();

  // ───── house accounts ─────
  const house = {
    HOUSE_FUNDING: await prisma.ledgerAccount.create({ data: { type: 'HOUSE_FUNDING', name: 'House – demo credit funding' } }),
    HOUSE_GAMING: await prisma.ledgerAccount.create({ data: { type: 'HOUSE_GAMING', name: 'House – gaming (stakes & payouts)' } }),
    HOUSE_BONUS: await prisma.ledgerAccount.create({ data: { type: 'HOUSE_BONUS', name: 'House – bonus & loyalty pool' } }),
  };

  // ───── catalogue ─────
  console.log('→ catalogue');
  const categories = new Map<string, string>();
  for (const c of CATEGORIES) categories.set(c.slug, (await prisma.gameCategory.create({ data: c })).id);
  const providers = new Map<string, string>();
  for (const p of PROVIDERS) {
    const row = await prisma.casinoProvider.create({ data: { code: p.code, name: p.name, integrationType: p.integrationType, status: p.status, description: p.description, config: p.config as Prisma.InputJsonValue, lastSyncAt: p.status === 'OPERATIONAL' ? new Date() : p.status === 'DISABLED' ? new Date(NOW - 12 * DAY) : null } });
    providers.set(p.code, row.id);
    if (p.status === 'NOT_CONFIGURED') await prisma.providerErrorLog.createMany({ data: [{ providerId: row.id, message: 'Handshake failed: API key not configured', context: { endpoint: '/v2/handshake' }, createdAt: new Date(NOW - 3 * DAY) }, { providerId: row.id, message: 'Session request rejected: provider NOT_CONFIGURED', createdAt: new Date(NOW - 1 * DAY) }] });
  }
  const games = new Map<string, { id: string; engine: string; name: string; minBet: bigint; maxBet: bigint }>();
  for (const g of GAMES) {
    const row = await prisma.casinoGame.create({
      data: {
        slug: g.slug,
        name: g.name,
        tagline: g.tagline,
        description: g.description,
        providerId: providers.get(g.provider)!,
        engine: g.engine,
        status: g.status ?? 'ACTIVE',
        volatility: g.volatility,
        rtpLabel: g.rtpLabel,
        minBetMinor: BigInt(g.minBetMinor),
        maxBetMinor: BigInt(g.maxBetMinor),
        artwork: g.artwork as Prisma.InputJsonValue,
        isFeatured: g.isFeatured ?? false,
        isNew: g.isNew ?? false,
        sortOrder: g.sortOrder,
        releasedAt: new Date(NOW - g.releasedDaysAgo * DAY),
        categories: { create: g.categories.map((slug) => ({ categoryId: categories.get(slug)! })) },
      },
    });
    games.set(g.slug, { id: row.id, engine: g.engine, name: g.name, minBet: row.minBetMinor, maxBet: row.maxBetMinor });
  }

  // ───── bonuses & promotions ─────
  const bonusIds = new Map<string, string>();
  for (const b of BONUSES) bonusIds.set(b.code, (await prisma.bonusDefinition.create({ data: b })).id);
  for (const p of PROMOTIONS) {
    await prisma.promotion.create({ data: { slug: p.slug, title: p.title, subtitle: p.subtitle, description: p.description, artwork: p.artwork as Prisma.InputJsonValue, ctaLabel: p.ctaLabel, bonusDefinitionId: p.bonus ? bonusIds.get(p.bonus) : null, startsAt: new Date(NOW - 30 * DAY), endsAt: p.slug === 'crash-launch' ? new Date(NOW + 20 * DAY) : null, sortOrder: p.sortOrder } });
  }

  await prisma.systemSetting.createMany({
    data: [
      { key: 'maintenanceMode', value: false, description: 'Blocks new game sessions when enabled' },
      { key: 'maxBetMinor', value: 1_000_000, description: 'Global max stake per round (minor units)' },
      { key: 'crashHouseEdgeBp', value: 100, description: 'House edge applied to new crash rounds (basis points)' },
      { key: 'dailyTopupLimitMinor', value: 5_000_000, description: 'Max demo credits a player can top up per day' },
    ],
  });

  // ───── users ─────
  console.log('→ users');
  const hashes = { player: await argon2.hash(DEMO_PASSWORDS.player), support: await argon2.hash(DEMO_PASSWORDS.support), operator: await argon2.hash(DEMO_PASSWORDS.operator), admin: await argon2.hash(DEMO_PASSWORDS.admin) };
  const staff = [
    { email: 'admin@spinharbor.demo', username: 'admin', role: 'ADMIN' as const, hash: hashes.admin, display: 'Platform Admin' },
    { email: 'operator@spinharbor.demo', username: 'operator', role: 'OPERATOR' as const, hash: hashes.operator, display: 'Casino Operator' },
    { email: 'support@spinharbor.demo', username: 'support', role: 'SUPPORT' as const, hash: hashes.support, display: 'Support Agent' },
  ];
  const staffIds: Record<string, string> = {};
  for (const s of staff) {
    const u = await createUser({ email: s.email, username: s.username, role: s.role, passwordHash: s.hash, displayName: s.display, country: 'MT', createdAt: new Date(NOW - 200 * DAY) }, house.HOUSE_FUNDING.id);
    staffIds[s.role] = u.id;
  }

  const players: { id: string; username: string; cashAccountId: string; bonusAccountId: string; walletId: string; createdAt: Date }[] = [];
  for (let i = 0; i < PLAYER_NAMES.length; i++) {
    const [username, displayName, country] = PLAYER_NAMES[i];
    const createdAt = new Date(NOW - between(31, 120) * DAY);
    const u = await createUser({ email: `${username}@spinharbor.demo`, username, role: 'PLAYER', passwordHash: hashes.player, displayName, country, createdAt }, house.HOUSE_FUNDING.id);
    players.push(u);
  }
  // Also a well-known demo login
  const demo = await createUser({ email: 'player@spinharbor.demo', username: 'player', role: 'PLAYER', passwordHash: hashes.player, displayName: 'Demo Player', country: 'DE', createdAt: new Date(NOW - 40 * DAY) }, house.HOUSE_FUNDING.id);
  players.push(demo);

  // ───── gameplay history ─────
  console.log('→ gameplay history (this takes a few seconds)');
  const playable = ['harbor-reels', 'harbor-dice', 'harbor-roulette', 'harbor-crash'];
  const sessions: Prisma.GameSessionCreateManyInput[] = [];
  const rounds: Prisma.GameRoundCreateManyInput[] = [];
  const roundTx: Prisma.GameRoundTransactionCreateManyInput[] = [];
  const ledger: Ledger = { entries: [], lines: [] };
  const loyaltyEvents: Prisma.LoyaltyEventCreateManyInput[] = [];
  const recents = new Map<string, Date>();
  const crashRounds: Prisma.CrashRoundCreateManyInput[] = [];
  const crashBets: Prisma.CrashBetCreateManyInput[] = [];
  const playCount = new Map<string, number>();
  const finalBalances = new Map<string, { cash: bigint; bonus: bigint }>();
  const lifetimePoints = new Map<string, number>();
  const playerBonuses: Prisma.PlayerBonusCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];

  const profiles = ['casual', 'regular', 'whale'] as const;
  for (const [pi, p] of players.entries()) {
    let cash = INITIAL;
    let seq = 0;
    const profile = pi === players.length - 1 ? 'regular' : pi < 3 ? 'whale' : pi < 10 ? 'regular' : 'casual';
    const sessionCount = profile === 'whale' ? between(14, 22) : profile === 'regular' ? between(6, 12) : between(2, 5);
    let points = 0;
    const post = (type: Prisma.JournalEntryCreateManyInput['type'], description: string, key: string, cashDelta: bigint, houseId: string, at: Date, ref?: { type: string; id: string }, bonusDelta = 0n, bonusAfter = 0n) => {
      const entryId = randomUUID();
      cash += cashDelta;
      ledger.entries.push({ id: entryId, type, description, idempotencyKey: key, referenceType: ref?.type, referenceId: ref?.id, createdAt: at });
      if (cashDelta !== 0n) ledger.lines.push({ id: randomUUID(), entryId, accountId: p.cashAccountId, amountMinor: cashDelta, balanceAfterMinor: cash, createdAt: at });
      if (bonusDelta !== 0n) ledger.lines.push({ id: randomUUID(), entryId, accountId: p.bonusAccountId, amountMinor: bonusDelta, balanceAfterMinor: bonusAfter, createdAt: at });
      ledger.lines.push({ id: randomUUID(), entryId, accountId: houseId, amountMinor: -(cashDelta + bonusDelta), createdAt: at });
      return entryId;
    };

    const firstDay = Math.min(30, Math.floor((NOW - p.createdAt.getTime()) / DAY) - 1);
    const sessionDays = Array.from({ length: sessionCount }, () => between(0, firstDay)).sort((a, b) => b - a);
    // daily reward claims for regulars/whales on a few days
    const dailyClaimDays = profile === 'casual' ? [] : [...new Set(Array.from({ length: between(2, 6) }, () => between(1, 25)))];
    for (const d of dailyClaimDays) {
      const at = new Date(NOW - d * DAY - between(2, 12) * 3600_000);
      const bonusId = randomUUID();
      const entryId = post('BONUS_AWARD', 'Daily Harbor Reward', `bonus:${bonusId}`, 50_000n, house.HOUSE_BONUS.id, at, { type: 'player_bonus', id: bonusId });
      playerBonuses.push({ id: bonusId, userId: p.id, definitionId: bonusIds.get('DAILY_500')!, status: 'COMPLETED', amountMinor: 50_000n, claimKey: `${p.id}:DAILY_500:${new Date(NOW - d * DAY).toISOString().slice(0, 10)}`, claimedAt: at, expiresAt: new Date(at.getTime() + DAY), completedAt: at, journalEntryId: entryId });
    }

    for (const dayAgo of sessionDays) {
      const slug = pick(playable);
      const g = games.get(slug)!;
      const sessionId = randomUUID();
      // Always strictly in the past (never later than one hour ago) so seeded history sorts below live activity.
      let at = new Date(NOW - dayAgo * DAY - between(1, 22) * 3600_000 - between(0, 59) * 60_000);
      const startedAt = at;
      const roundCount = profile === 'whale' ? between(12, 30) : between(5, 18);
      let sStaked = 0n;
      let sPaid = 0n;
      for (let r = 0; r < roundCount; r++) {
        at = new Date(at.getTime() + between(8, 40) * 1000);
        const options = g.engine === 'SLOTS' ? SLOTS_CONFIG.betOptionsMinor : g.engine === 'DICE' ? DICE_CONFIG.betOptionsMinor : g.engine === 'ROULETTE' ? ROULETTE_CONFIG.chipOptionsMinor : CRASH_CONFIG.betOptionsMinor;
        const cap = profile === 'whale' ? options.length : profile === 'regular' ? Math.min(options.length, 4) : 2;
        let stake = BigInt(options[rng.nextInt(cap)]);
        if (g.engine === 'ROULETTE') stake *= BigInt(between(1, 3));
        if (cash < stake) {
          // Player ran dry: demo reset (counts as top-up), exactly as the app would do.
          post('DEMO_RESET', 'Demo balance reset', `reset:${p.id}:${seq++}`, INITIAL - cash, house.HOUSE_FUNDING.id, at);
        }
        const roundId = randomUUID();
        let input: Record<string, unknown> = {};
        let result: Record<string, unknown> = {};
        let payout = 0n;
        if (g.engine === 'SLOTS') {
          const { totalWinMinor, ...res } = playSlots(rng, stake);
          payout = totalWinMinor;
          result = res as Record<string, unknown>;
        } else if (g.engine === 'DICE') {
          const direction = pick(['OVER', 'UNDER'] as const);
          const target = between(20, 80) * 100;
          const { payoutMinor, ...res } = playDice(rng, { direction, target, stakeMinor: stake });
          payout = payoutMinor;
          input = { direction, target };
          result = res as Record<string, unknown>;
        } else if (g.engine === 'ROULETTE') {
          const chip = Number(stake) / between(1, 3);
          const betTypes = ['RED', 'BLACK', 'ODD', 'EVEN', 'LOW', 'HIGH', 'DOZEN_1', 'DOZEN_2', 'COLUMN_3', 'STRAIGHT'] as const;
          const n = between(1, 3);
          const bets = Array.from({ length: n }, () => {
            const type = pick(betTypes);
            return { type, number: type === 'STRAIGHT' ? between(0, 36) : undefined, amountMinor: Math.max(100, Math.floor(chip / n / 100) * 100) };
          });
          stake = bets.reduce((a, b) => a + BigInt(b.amountMinor), 0n);
          const { totalPayoutMinorBig, totalStakeMinorBig, ...res } = playRoulette(rng, bets);
          void totalStakeMinorBig;
          payout = totalPayoutMinorBig;
          input = { bets };
          result = res as Record<string, unknown>;
        } else {
          // crash: simulate an auto cash-out target vs. the crash point
          const seed = rng.seedHex(16);
          const crashBp = crashPointFromSeed(seed);
          const autoBp = pick([15_000, 18_000, 20_000, 25_000, 30_000, 50_000]);
          const cashed = autoBp < crashBp;
          payout = cashed ? (stake * BigInt(autoBp)) / 10_000n : 0n;
          const crashRoundId = randomUUID();
          const startsAt = at;
          const crashedAt = new Date(startsAt.getTime() + crashTimeToReach(crashBp));
          crashRounds.push({ id: crashRoundId, status: 'SETTLED', crashMultiplierBp: crashBp, serverSeedHash: sha256Hex(seed), serverSeed: seed, bettingOpensAt: new Date(startsAt.getTime() - CRASH_CONFIG.bettingWindowMs), startsAt, crashedAt, settledAt: new Date(crashedAt.getTime() + CRASH_CONFIG.settleDelayMs), createdAt: new Date(startsAt.getTime() - CRASH_CONFIG.bettingWindowMs - CRASH_CONFIG.waitingMs) });
          crashBets.push({ id: randomUUID(), crashRoundId, userId: p.id, gameRoundId: roundId, stakeMinor: stake, autoCashoutBp: autoBp, status: cashed ? 'CASHED_OUT' : 'LOST', cashoutMultiplierBp: cashed ? autoBp : null, cashedOutAt: cashed ? new Date(startsAt.getTime() + crashTimeToReach(autoBp)) : null, payoutMinor: payout, createdAt: new Date(startsAt.getTime() - 2000) });
          input = { autoCashoutBp: autoBp, crashRoundId };
          result = { cashedOut: cashed, mode: 'auto', cashoutMultiplierBp: cashed ? autoBp : null, crashMultiplierBp: crashBp, autoCashoutBp: autoBp };
          at = new Date(crashedAt.getTime() + 1000);
          void crashMultiplierAt;
        }
        if (cash < stake) post('DEMO_RESET', 'Demo balance reset', `reset:${p.id}:${seq++}`, INITIAL - cash, house.HOUSE_FUNDING.id, at);
        const stakeEntry = post('STAKE', `${g.name} – stake`, `stake:${roundId}`, -stake, house.HOUSE_GAMING.id, at, { type: 'game_round', id: roundId });
        roundTx.push({ id: randomUUID(), roundId, type: 'STAKE', amountMinor: stake, journalEntryId: stakeEntry, createdAt: at });
        const settledAt = new Date(at.getTime() + 1500);
        if (payout > 0n) {
          const payEntry = post('PAYOUT', `${g.name} – win`, `payout:${roundId}`, payout, house.HOUSE_GAMING.id, settledAt, { type: 'game_round', id: roundId });
          roundTx.push({ id: randomUUID(), roundId, type: 'PAYOUT', amountMinor: payout, journalEntryId: payEntry, createdAt: settledAt });
        }
        rounds.push({ id: roundId, sessionId, userId: p.id, gameId: g.id, engine: g.engine as any, status: 'SETTLED', stakeMinor: stake, payoutMinor: payout, input: input as Prisma.InputJsonValue, result: result as Prisma.InputJsonValue, rngSeedHash: sha256Hex(`${roundId}:seed`), idempotencyKey: `${p.id}:seed-${roundId}`, createdAt: at, settledAt });
        const pts = Number(stake / 1000n);
        if (pts > 0) {
          loyaltyEvents.push({ id: randomUUID(), userId: p.id, roundId, points: pts, reason: 'Wager', createdAt: settledAt });
          points += pts;
        }
        sStaked += stake;
        sPaid += payout;
        playCount.set(g.id, (playCount.get(g.id) ?? 0) + 1);
      }
      sessions.push({ id: sessionId, userId: p.id, gameId: g.id, providerId: providers.get('spinharbor-studios')!, status: dayAgo === 0 && rng.nextFloat() < 0.4 ? 'ACTIVE' : 'CLOSED', token: `demo_seed_${sessionId.slice(0, 12)}`, startedAt, lastActivityAt: at, closedAt: dayAgo === 0 ? null : new Date(at.getTime() + 60_000), roundsCount: roundCount, totalStakedMinor: sStaked, totalPaidMinor: sPaid });
      recents.set(`${p.id}|${g.id}`, at);
    }

    // Active welcome bonus for a few players (claimed recently, nothing wagered yet).
    let bonus = 0n;
    if (pi % 7 === 3) {
      const at = new Date(NOW - between(1, 3) * 3600_000);
      const bonusId = randomUUID();
      bonus = 200_000n;
      const entryId = post('BONUS_AWARD', 'Welcome Bonus', `bonus:${bonusId}`, 0n, house.HOUSE_BONUS.id, at, { type: 'player_bonus', id: bonusId }, bonus, bonus);
      playerBonuses.push({ id: bonusId, userId: p.id, definitionId: bonusIds.get('WELCOME_2000')!, status: 'ACTIVE', amountMinor: bonus, wageringRequiredMinor: bonus * 5n, claimKey: `${p.id}:WELCOME_2000`, claimedAt: at, expiresAt: new Date(at.getTime() + 7 * DAY), journalEntryId: entryId });
    }
    finalBalances.set(p.id, { cash, bonus });
    lifetimePoints.set(p.id, points);
    const tier = tierFor(points);
    if (tier !== 'BRONZE') notifications.push({ userId: p.id, type: 'loyalty.tier', title: `Welcome to ${tier.charAt(0) + tier.slice(1).toLowerCase()}!`, body: 'Your loyalty tier was upgraded. Check the Loyalty page for your milestone reward.', createdAt: new Date(NOW - between(1, 10) * DAY) });
  }

  console.log(`→ inserting ${rounds.length} rounds, ${ledger.entries.length} journal entries, ${ledger.lines.length} lines`);
  const chunk = async <T>(rows: T[], fn: (batch: T[]) => Promise<unknown>, size = 1000) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  };
  await chunk(sessions, (b) => prisma.gameSession.createMany({ data: b }));
  await chunk(ledger.entries, (b) => prisma.journalEntry.createMany({ data: b }));
  await chunk(ledger.lines, (b) => prisma.journalLine.createMany({ data: b }));
  await chunk(rounds, (b) => prisma.gameRound.createMany({ data: b }));
  await chunk(roundTx, (b) => prisma.gameRoundTransaction.createMany({ data: b }));
  await chunk(crashRounds, (b) => prisma.crashRound.createMany({ data: b }));
  await chunk(crashBets, (b) => prisma.crashBet.createMany({ data: b }));
  await chunk(loyaltyEvents, (b) => prisma.loyaltyEvent.createMany({ data: b }));
  await prisma.playerBonus.createMany({ data: playerBonuses });
  await prisma.notification.createMany({ data: notifications });
  await prisma.playerRecentGame.createMany({ data: [...recents.entries()].map(([k, lastPlayedAt]) => ({ userId: k.split('|')[0], gameId: k.split('|')[1], lastPlayedAt })) });
  for (const [gameId, count] of playCount) await prisma.casinoGame.update({ where: { id: gameId }, data: { playCount: count } });

  for (const p of players) {
    const b = finalBalances.get(p.id)!;
    await prisma.wallet.update({ where: { id: p.walletId }, data: { balanceMinor: b.cash, bonusBalanceMinor: b.bonus, version: 1 } });
    const pts = lifetimePoints.get(p.id) ?? 0;
    await prisma.loyaltyAccount.update({ where: { userId: p.id }, data: { points: BigInt(pts), lifetimePoints: BigInt(pts), tier: tierFor(pts), tierUpdatedAt: new Date(NOW - 5 * DAY) } });
  }

  // ───── favourites, limits, statuses, risk, audit ─────
  console.log('→ player state, risk flags, audit trail');
  const gameList = [...games.values()];
  for (const p of players) {
    const favs = new Set<string>();
    for (let i = 0; i < between(1, 4); i++) favs.add(pick(gameList).id);
    await prisma.playerFavorite.createMany({ data: [...favs].map((gameId) => ({ userId: p.id, gameId })) });
  }
  await prisma.playerLimit.createMany({ data: [{ userId: players[4].id, type: 'DAILY_WAGER', value: 500_000n }, { userId: players[4].id, type: 'SESSION_MINUTES', value: 90n }, { userId: players[9].id, type: 'DAILY_LOSS', value: 200_000n }, { userId: demo.id, type: 'DAILY_TOPUP', value: 3_000_000n }] });

  const suspended = players[12];
  const excluded = players[15];
  const cooling = players[17];
  await prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED', statusReason: 'Multiple accounts suspected (demo scenario)' } });
  await prisma.user.update({ where: { id: excluded.id }, data: { status: 'SELF_EXCLUDED', statusReason: 'Self-exclusion for 90 days', statusUntil: new Date(NOW + 80 * DAY) } });
  await prisma.user.update({ where: { id: cooling.id }, data: { status: 'COOLING_OFF', statusReason: 'Voluntary cooling-off for 72h', statusUntil: new Date(NOW + 2 * DAY) } });

  const whale = players[0];
  await prisma.riskFlag.createMany({
    data: [
      { userId: whale.id, code: 'HIGH_STAKE', severity: 'LOW', status: 'OPEN', description: 'Single stake of 250 credits', metadata: { stakeMinor: 25_000 }, createdAt: new Date(NOW - 2 * DAY) },
      { userId: players[1].id, code: 'HEAVY_LOSS_24H', severity: 'HIGH', status: 'OPEN', description: 'Net loss of 6,200 credits in 24h', metadata: { lossMinor: 620_000 }, createdAt: new Date(NOW - 1 * DAY) },
      { userId: suspended.id, code: 'MULTI_ACCOUNT', severity: 'HIGH', status: 'REVIEWED', description: 'Shared device fingerprint with 2 other accounts', reviewedById: staffIds.OPERATOR, reviewedAt: new Date(NOW - 4 * DAY), resolution: 'Account suspended pending verification', createdAt: new Date(NOW - 5 * DAY) },
      { userId: players[2].id, code: 'HIGH_VELOCITY', severity: 'MEDIUM', status: 'DISMISSED', description: '320 rounds in 24h', reviewedById: staffIds.SUPPORT, reviewedAt: new Date(NOW - 6 * DAY), resolution: 'Known high-frequency dice player', createdAt: new Date(NOW - 7 * DAY) },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: staffIds.OPERATOR, actorRole: 'OPERATOR', action: 'player.status.suspended', targetType: 'user', targetId: suspended.id, metadata: { reason: 'Multiple accounts suspected (demo scenario)', previous: 'ACTIVE' }, createdAt: new Date(NOW - 4 * DAY) },
      { actorId: excluded.id, actorRole: 'PLAYER', action: 'rg.self_exclude', targetType: 'user', targetId: excluded.id, metadata: { until: new Date(NOW + 80 * DAY), reason: 'Self-exclusion for 90 days' }, createdAt: new Date(NOW - 10 * DAY) },
      { actorId: cooling.id, actorRole: 'PLAYER', action: 'rg.cooling_off', targetType: 'user', targetId: cooling.id, metadata: { reason: 'Voluntary cooling-off for 72h' }, createdAt: new Date(NOW - 1 * DAY) },
      { actorId: staffIds.OPERATOR, actorRole: 'OPERATOR', action: 'game.update', targetType: 'game', targetId: games.get('pirates-plunder')!.id, metadata: { changes: { status: 'DISABLED' }, previousStatus: 'ACTIVE' }, createdAt: new Date(NOW - 20 * DAY) },
      { actorId: staffIds.OPERATOR, actorRole: 'OPERATOR', action: 'game.update', targetType: 'game', targetId: games.get('mega-wheel-marina')!.id, metadata: { changes: { status: 'MAINTENANCE' }, previousStatus: 'ACTIVE' }, createdAt: new Date(NOW - 2 * DAY) },
      { actorId: staffIds.OPERATOR, actorRole: 'OPERATOR', action: 'provider.update', targetType: 'provider', targetId: providers.get('tidal-labs')!, metadata: { status: 'DISABLED', previousStatus: 'OPERATIONAL' }, createdAt: new Date(NOW - 12 * DAY) },
      { actorId: staffIds.ADMIN, actorRole: 'ADMIN', action: 'settings.update', targetType: 'settings', metadata: { crashHouseEdgeBp: 100 }, createdAt: new Date(NOW - 20 * DAY) },
      { actorId: staffIds.ADMIN, actorRole: 'ADMIN', action: 'auth.login', targetType: 'user', targetId: staffIds.ADMIN, createdAt: new Date(NOW - 1 * DAY) },
    ],
  });

  // ───── verify reconciliation ─────
  console.log('→ verifying ledger reconciliation');
  const sum = await prisma.journalLine.aggregate({ _sum: { amountMinor: true } });
  if ((sum._sum.amountMinor ?? 0n) !== 0n) throw new Error(`Journal does not balance: ${sum._sum.amountMinor}`);
  for (const p of players) {
    const [cash, bonus, wallet] = await Promise.all([
      prisma.journalLine.aggregate({ where: { accountId: p.cashAccountId }, _sum: { amountMinor: true } }),
      prisma.journalLine.aggregate({ where: { accountId: p.bonusAccountId }, _sum: { amountMinor: true } }),
      prisma.wallet.findUniqueOrThrow({ where: { id: p.walletId } }),
    ]);
    if ((cash._sum.amountMinor ?? 0n) !== wallet.balanceMinor || (bonus._sum.amountMinor ?? 0n) !== wallet.bonusBalanceMinor) throw new Error(`Wallet ${p.username} does not reconcile`);
  }
  const counts = { players: players.length, rounds: rounds.length, entries: ledger.entries.length, lines: ledger.lines.length, crashRounds: crashRounds.length };
  console.log('✓ seed complete', counts);
  console.log('\nDemo accounts:');
  console.log('  player@spinharbor.demo / Player123!   (also marina_k … marlin_max, same password)');
  console.log('  support@spinharbor.demo / Support123!');
  console.log('  operator@spinharbor.demo / Operator123!');
  console.log('  admin@spinharbor.demo / Admin123!');
}

async function createUser(input: { email: string; username: string; role: 'PLAYER' | 'SUPPORT' | 'OPERATOR' | 'ADMIN'; passwordHash: string; displayName: string; country: string; createdAt: Date }, fundingAccountId: string) {
  const user = await prisma.user.create({ data: { email: input.email, username: input.username, role: input.role, passwordHash: input.passwordHash, createdAt: input.createdAt, lastLoginAt: new Date(NOW - between(0, 5) * DAY), profile: { create: { displayName: input.displayName, avatarSeed: input.username, country: input.country } }, loyalty: { create: {} } } });
  const cash = await prisma.ledgerAccount.create({ data: { type: 'PLAYER_CASH', userId: user.id, name: 'Player cash' } });
  const bonus = await prisma.ledgerAccount.create({ data: { type: 'PLAYER_BONUS', userId: user.id, name: 'Player bonus' } });
  const wallet = await prisma.wallet.create({ data: { userId: user.id, cashAccountId: cash.id, bonusAccountId: bonus.id, balanceMinor: INITIAL } });
  await prisma.journalEntry.create({ data: { type: 'INITIAL_FUNDING', description: 'Welcome demo credits', idempotencyKey: `initial:${user.id}`, createdAt: input.createdAt, lines: { create: [{ accountId: cash.id, amountMinor: INITIAL, balanceAfterMinor: INITIAL, createdAt: input.createdAt }, { accountId: fundingAccountId, amountMinor: -INITIAL, createdAt: input.createdAt }] } } });
  return { id: user.id, username: user.username, cashAccountId: cash.id, bonusAccountId: bonus.id, walletId: wallet.id, createdAt: input.createdAt };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
