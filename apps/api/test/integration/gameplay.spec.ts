import { FixedRng } from '@spinharbor/engines';
import { GameplayService } from '../../src/games/gameplay.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { WalletService } from '../../src/wallet/wallet.service';
import { createTestApp, openSession, registerPlayer, resetDb, seedBasics, type TestContext } from '../helpers';

describe('gameplay (integration, deterministic RNG)', () => {
  let ctx: TestContext;
  let rng: FixedRng;
  let ledger: LedgerService;

  beforeAll(async () => {
    rng = new FixedRng([8470]); // dice roll 84.70
    ctx = await createTestApp(rng);
    await resetDb(ctx.prisma);
    await seedBasics(ctx);
    ledger = ctx.app.get(LedgerService);
  });
  afterAll(() => ctx.close());

  const setRolls = (ints: number[]) => {
    (rng as any).ints = ints;
    (rng as any).i = 0;
  };

  it('plays a winning dice round: stake debited, payout credited, journal reconciles', async () => {
    setRolls([8470]);
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const res = await agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-dice-win-1' });
    expect(res.status).toBe(201);
    expect(res.body.round.status).toBe('SETTLED');
    expect(res.body.round.result).toMatchObject({ roll: 8470, won: true, multiplierBp: 19803 });
    expect(res.body.round.payoutMinor).toBe(1980);
    expect(res.body.wallet.balanceMinor).toBe(1_000_000 - 1000 + 1980);
    expect(res.body.loyaltyPointsAwarded).toBe(1);
    const txs = await ctx.prisma.gameRoundTransaction.findMany({ where: { roundId: res.body.round.id } });
    expect(txs.map((t) => t.type).sort()).toEqual(['PAYOUT', 'STAKE']);
    expect((await ledger.reconcileUser(user.id)).ok).toBe(true);
  });

  it('plays a losing dice round and only debits the stake', async () => {
    setRolls([1200]);
    const { agent } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const res = await agent.post('/games/dice/play').send({ sessionId, betMinor: 2500, direction: 'OVER', target: 5000, idempotencyKey: 'key-dice-lose-1' });
    expect(res.status).toBe(201);
    expect(res.body.round.result.won).toBe(false);
    expect(res.body.round.payoutMinor).toBe(0);
    expect(res.body.wallet.balanceMinor).toBe(997_500);
  });

  it('rejects duplicate rounds: same idempotency key replays the original result without charging again', async () => {
    setRolls([9000, 100]);
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const body = { sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-dup-round-1' };
    const first = await agent.post('/games/dice/play').send(body);
    const second = await agent.post('/games/dice/play').send(body);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.round.id).toBe(first.body.round.id);
    expect(await ctx.prisma.gameRound.count({ where: { userId: user.id } })).toBe(1);
    // same key, different body → conflict
    const mismatch = await agent.post('/games/dice/play').send({ ...body, betMinor: 5000 });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_MISMATCH');
  });

  it('handles concurrent identical requests: exactly one round is created', async () => {
    setRolls([9000, 9000, 9000, 9000, 9000]);
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const body = { sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-race-1' };
    const results = await Promise.all(Array.from({ length: 5 }, () => agent.post('/games/dice/play').send(body)));
    for (const r of results) expect([200, 201]).toContain(r.status);
    const ids = new Set(results.map((r) => r.body.round.id));
    expect(ids.size).toBe(1);
    expect(await ctx.prisma.gameRound.count({ where: { userId: user.id } })).toBe(1);
    expect((await ledger.reconcileUser(user.id)).ok).toBe(true);
  });

  it('prevents a duplicate payout: settling an already-settled round throws and credits nothing', async () => {
    setRolls([8470]);
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const res = await agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-dup-payout-1' });
    const gameplay = ctx.app.get(GameplayService);
    const round = await ctx.prisma.gameRound.findUniqueOrThrow({ where: { id: res.body.round.id }, include: { game: { select: { slug: true, name: true } } } });
    await expect(ctx.prisma.$transaction((tx) => gameplay.settleRound(tx, { round, payoutMinor: 1980n, result: {}, bonusStakeMinor: 0n }))).rejects.toMatchObject({ code: 'ROUND_ALREADY_SETTLED' });
    expect((await ctx.app.get(WalletService).getWallet(user.id)).balanceMinor).toBe(1_000_980);
    expect(await ctx.prisma.gameRoundTransaction.count({ where: { roundId: round.id, type: 'PAYOUT' } })).toBe(1);
  });

  it('computes slots payouts server-side from the reel stops', async () => {
    // Reel strips start with ANCHOR,GEM,CROWN,... (interleaved by weight); stop 1 on each reel yields GEM on row 0.
    setRolls([1, 1, 1, 1, 1]);
    const { agent } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-reels');
    const res = await agent.post('/games/slots/play').send({ sessionId, betMinor: 1000, idempotencyKey: 'key-slots-1' });
    expect(res.status).toBe(201);
    const result = res.body.round.result;
    expect(result.grid).toHaveLength(5);
    expect(result.grid[0]).toHaveLength(3);
    const expected = result.wins.reduce((a: number, w: any) => a + w.winMinor, 0) + result.scatterWinMinor;
    expect(res.body.round.payoutMinor).toBe(expected);
    expect(result.wins.length).toBeGreaterThan(0);
    expect(res.body.wallet.balanceMinor).toBe(1_000_000 - 1000 + expected);
  });

  it('settles roulette with standard odds and rejects a stake/bet mismatch', async () => {
    setRolls([17]);
    const { agent } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-roulette');
    const res = await agent.post('/games/roulette/play').send({ sessionId, bets: [{ type: 'STRAIGHT', number: 17, amountMinor: 100 }, { type: 'BLACK', amountMinor: 500 }, { type: 'RED', amountMinor: 500 }], idempotencyKey: 'key-roul-1' });
    expect(res.status).toBe(201);
    expect(res.body.round.result.winningNumber).toBe(17);
    expect(res.body.round.stakeMinor).toBe(1100);
    expect(res.body.round.payoutMinor).toBe(3600 + 1000);
    const bad = await agent.post('/games/roulette/play').send({ sessionId, bets: [{ type: 'STRAIGHT', amountMinor: 100 }], idempotencyKey: 'key-roul-2' });
    expect(bad.status).toBe(400);
  });

  it('rejects bets outside the game range and with an insufficient balance', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const tooSmall = await agent.post('/games/dice/play').send({ sessionId, betMinor: 50, direction: 'OVER', target: 5000, idempotencyKey: 'key-range-1' });
    expect(tooSmall.body.code).toBe('BET_OUT_OF_RANGE');
    await ctx.prisma.wallet.update({ where: { userId: user.id }, data: { balanceMinor: 500n } });
    const broke = await agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-range-2' });
    expect(broke.status).toBe(422);
    expect(broke.body.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('enforces self-exclusion, cooling-off and suspension on every round', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    const play = (key: string) => agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: `key-${key}` });
    const rg = await agent.post('/responsible-gaming/self-exclude').send({ days: 30, confirmation: 'EXCLUDE ME' });
    expect(rg.status).toBe(201);
    expect(rg.body.status).toBe('SELF_EXCLUDED');
    const blocked = await play('excl-1');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_RESTRICTED');
    // an expired exclusion is lifted automatically
    await ctx.prisma.user.update({ where: { id: user.id }, data: { statusUntil: new Date(Date.now() - 1000) } });
    const session2 = await openSession(agent, 'harbor-dice');
    const ok = await agent.post('/games/dice/play').send({ sessionId: session2, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-excl-2' });
    expect(ok.status).toBe(201);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const susp = await agent.post('/games/dice/play').send({ sessionId: session2, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-excl-3' });
    expect(susp.status).toBe(403);
    expect(await ctx.prisma.gameRound.count({ where: { userId: user.id } })).toBe(1);
  });

  it('enforces player wager limits inside the round transaction', async () => {
    setRolls([100, 100, 100]);
    const { agent } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    await agent.put('/responsible-gaming/limits').send({ type: 'DAILY_WAGER', value: 1500 });
    const first = await agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-lim-1' });
    expect(first.status).toBe(201);
    const second = await agent.post('/games/dice/play').send({ sessionId, betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-lim-2' });
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('LIMIT_EXCEEDED');
    expect(second.body.details.type).toBe('DAILY_WAGER');
  });

  it('refuses sessions for preview games, disabled games and non-operational providers', async () => {
    const { agent } = await registerPlayer(ctx);
    const r1 = await agent.post('/games/sessions').send({ gameSlug: 'preview-game' });
    expect(r1.status).toBe(409);
    await ctx.prisma.casinoGame.update({ where: { slug: 'harbor-roulette' }, data: { status: 'MAINTENANCE' } });
    const r2 = await agent.post('/games/sessions').send({ gameSlug: 'harbor-roulette' });
    expect(r2.body.code).toBe('GAME_UNAVAILABLE');
    await ctx.prisma.casinoGame.update({ where: { slug: 'harbor-roulette' }, data: { status: 'ACTIVE' } });
    const other = await registerPlayer(ctx);
    const foreign = await other.agent.post('/games/dice/play').send({ sessionId: await openSession(agent, 'harbor-dice'), betMinor: 1000, direction: 'OVER', target: 5000, idempotencyKey: 'key-foreign-1' });
    expect(foreign.body.code).toBe('SESSION_INVALID');
  });
});
