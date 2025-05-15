import { crashMultiplierAt } from '@spinharbor/engines';
import { CrashService } from '../../src/games/crash/crash.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { createTestApp, registerPlayer, resetDb, seedBasics, type TestContext } from '../helpers';

/** The autonomous loop is disabled in tests; rounds are driven manually to assert state validation. */
describe('crash cash-out state validation (integration)', () => {
  let ctx: TestContext;
  let crash: CrashService;
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const { games } = await seedBasics(ctx);
    crash = ctx.app.get(CrashService);
    (crash as any).gameId = games['harbor-crash'];
  });
  afterAll(() => ctx.close());

  async function makeRound(status: 'WAITING' | 'BETTING_OPEN' | 'RUNNING' | 'CRASHED', opts: { startsInMs?: number; crashBp?: number } = {}) {
    const startsAt = new Date(Date.now() + (opts.startsInMs ?? 5000));
    const round = await ctx.prisma.crashRound.create({ data: { status, crashMultiplierBp: opts.crashBp ?? 30_000, serverSeedHash: 'hash', serverSeed: 'seed', bettingOpensAt: new Date(startsAt.getTime() - 8000), startsAt } });
    (crash as any).current = round;
    return round;
  }

  it('rejects bets unless betting is open and rejects duplicate bets', async () => {
    const { agent } = await registerPlayer(ctx);
    const waiting = await makeRound('WAITING');
    const r1 = await agent.post('/games/crash/bet').send({ roundId: waiting.id, stakeMinor: 1000, idempotencyKey: 'key-c-bet-1' });
    expect(r1.body.code).toBe('ROUND_CLOSED');
    const open = await makeRound('BETTING_OPEN');
    const r2 = await agent.post('/games/crash/bet').send({ roundId: open.id, stakeMinor: 1000, autoCashoutBp: 20_000, idempotencyKey: 'key-c-bet-2' });
    expect(r2.status).toBe(201);
    expect(r2.body.bet.status).toBe('PLACED');
    expect(r2.body.bet.autoCashoutBp).toBe(20_000);
    expect(r2.body.wallet.balanceMinor).toBe(999_000);
    const r3 = await agent.post('/games/crash/bet').send({ roundId: open.id, stakeMinor: 1000, idempotencyKey: 'key-c-bet-3' });
    expect(r3.body.code).toBe('DUPLICATE_BET');
    const closed = await makeRound('BETTING_OPEN', { startsInMs: -10 });
    const r4 = await agent.post('/games/crash/bet').send({ roundId: closed.id, stakeMinor: 1000, idempotencyKey: 'key-c-bet-4' });
    expect(r4.body.code).toBe('ROUND_CLOSED');
  });

  it('only allows cash-out while RUNNING and before the crash point; duplicate cash-outs fail', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const round = await makeRound('BETTING_OPEN', { crashBp: 30_000 });
    const bet = await agent.post('/games/crash/bet').send({ roundId: round.id, stakeMinor: 1000, idempotencyKey: 'key-c-co-1' });
    expect(bet.status).toBe(201);
    const early = await agent.post('/games/crash/cashout').send({ roundId: round.id });
    expect(early.body.code).toBe('ROUND_CLOSED');
    // Running for 5 seconds → multiplier ≈ 1.41x, below the 3.00x crash point
    const running = await ctx.prisma.crashRound.update({ where: { id: round.id }, data: { status: 'RUNNING', startsAt: new Date(Date.now() - 5000) } });
    (crash as any).current = running;
    const ok = await agent.post('/games/crash/cashout').send({ roundId: round.id });
    expect(ok.status).toBe(201);
    expect(ok.body.bet.status).toBe('CASHED_OUT');
    expect(ok.body.bet.cashoutMultiplierBp).toBeGreaterThanOrEqual(crashMultiplierAt(4900));
    expect(ok.body.bet.cashoutMultiplierBp).toBeLessThan(15_000);
    expect(ok.body.bet.payoutMinor).toBe(Math.floor((1000 * ok.body.bet.cashoutMultiplierBp) / 10_000));
    const dup = await agent.post('/games/crash/cashout').send({ roundId: round.id });
    expect(dup.body.code).toBe('NO_OPEN_BET');
    const gameRound = await ctx.prisma.gameRound.findFirstOrThrow({ where: { userId: user.id, engine: 'CRASH' } });
    expect(gameRound.status).toBe('SETTLED');
    expect(Number(gameRound.payoutMinor)).toBe(ok.body.bet.payoutMinor);
    expect((await ctx.app.get(LedgerService).reconcileUser(user.id)).ok).toBe(true);
  });

  it('refuses a cash-out after the crash point has been passed (no backdating)', async () => {
    const { agent } = await registerPlayer(ctx);
    const round = await makeRound('BETTING_OPEN', { crashBp: 12_000 });
    await agent.post('/games/crash/bet').send({ roundId: round.id, stakeMinor: 1000, idempotencyKey: 'key-c-late-1' });
    // 20s elapsed → 4.00x > 1.20x crash point
    (crash as any).current = await ctx.prisma.crashRound.update({ where: { id: round.id }, data: { status: 'RUNNING', startsAt: new Date(Date.now() - 20_000) } });
    const late = await agent.post('/games/crash/cashout').send({ roundId: round.id });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('ROUND_CRASHED');
    const bet = await ctx.prisma.crashBet.findFirstOrThrow({ where: { crashRoundId: round.id } });
    expect(bet.status).toBe('PLACED');
    expect(bet.payoutMinor).toBe(0n);
  });

  it('exposes a snapshot that hides the crash point until the round has crashed', async () => {
    const round = await makeRound('RUNNING', { crashBp: 25_000, startsInMs: -1000 });
    const hidden = await ctx.http().get('/games/crash/state');
    expect(hidden.body.crashMultiplierBp).toBeNull();
    expect(hidden.body.serverSeed).toBeNull();
    expect(hidden.body.serverSeedHash).toBe('hash');
    (crash as any).current = await ctx.prisma.crashRound.update({ where: { id: round.id }, data: { status: 'CRASHED', crashedAt: new Date() } });
    const revealed = await ctx.http().get('/games/crash/state');
    expect(revealed.body.crashMultiplierBp).toBe(25_000);
    expect(revealed.body.serverSeed).toBe('seed');
  });
});
