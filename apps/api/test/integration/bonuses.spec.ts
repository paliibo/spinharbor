import { FixedRng } from '@spinharbor/engines';
import { LedgerService } from '../../src/ledger/ledger.service';
import { createTestApp, openSession, registerPlayer, resetDb, seedBasics, type TestContext } from '../helpers';

describe('bonuses & loyalty (integration)', () => {
  let ctx: TestContext;
  let rng: FixedRng;
  beforeAll(async () => {
    rng = new FixedRng([100]);
    ctx = await createTestApp(rng);
    await resetDb(ctx.prisma);
    await seedBasics(ctx);
  });
  afterAll(() => ctx.close());

  it('claims the welcome bonus into the bonus balance and blocks a second claim', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const elig = await agent.get('/bonuses');
    expect(elig.body.find((b: any) => b.definition.code === 'WELCOME_2000').eligible).toBe(true);
    const claim = await agent.post('/bonuses/claim').send({ code: 'WELCOME_2000' });
    expect(claim.status).toBe(201);
    expect(claim.body.bonus.status).toBe('ACTIVE');
    expect(claim.body.wallet.bonusBalanceMinor).toBe(200_000);
    expect(claim.body.wallet.balanceMinor).toBe(1_000_000);
    const again = await agent.post('/bonuses/claim').send({ code: 'WELCOME_2000' });
    expect(again.status).toBe(409);
    expect(await ctx.prisma.playerBonus.count({ where: { userId: user.id } })).toBe(1);
    expect((await ctx.app.get(LedgerService).reconcileUser(user.id)).ok).toBe(true);
  });

  it('allows only one of many concurrent claims to succeed', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const results = await Promise.all(Array.from({ length: 6 }, () => agent.post('/bonuses/claim').send({ code: 'DAILY_500' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await ctx.prisma.playerBonus.count({ where: { userId: user.id } })).toBe(1);
    const w = await ctx.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(w.balanceMinor).toBe(1_050_000n);
  });

  it('consumes cash before bonus funds, tracks wagering and releases bonus funds when complete', async () => {
    const { agent, user } = await registerPlayer(ctx);
    await agent.post('/bonuses/claim').send({ code: 'WELCOME_2000' });
    // drain cash so stakes draw on the bonus balance
    await ctx.prisma.wallet.update({ where: { userId: user.id }, data: { balanceMinor: 0n } });
    await ctx.prisma.journalLine.create({ data: { entryId: (await ctx.prisma.journalEntry.create({ data: { type: 'ADJUSTMENT', description: 'test drain', idempotencyKey: `drain-${user.id}`, lines: { create: [] } } })).id, accountId: (await ctx.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).cashAccountId, amountMinor: -1_000_000n } });
    const sessionId = await openSession(agent, 'harbor-dice');
    (rng as any).ints = [100];
    (rng as any).i = 0;
    const res = await agent.post('/games/dice/play').send({ sessionId, betMinor: 10_000, direction: 'OVER', target: 5000, idempotencyKey: 'key-bonus-stake-1' });
    expect(res.status).toBe(201);
    expect(res.body.wallet.bonusBalanceMinor).toBe(190_000);
    const round = await ctx.prisma.gameRound.findUniqueOrThrow({ where: { id: res.body.round.id } });
    expect(round.bonusStakeMinor).toBe(10_000n);
    const pb = await ctx.prisma.playerBonus.findFirstOrThrow({ where: { userId: user.id } });
    expect(pb.wageringProgressMinor).toBe(10_000n);
    expect(pb.wageringRequiredMinor).toBe(1_000_000n);
    // complete wagering by marking progress just below the requirement, then one more stake
    await ctx.prisma.playerBonus.update({ where: { id: pb.id }, data: { wageringProgressMinor: 995_000n } });
    (rng as any).i = 0;
    const res2 = await agent.post('/games/dice/play').send({ sessionId, betMinor: 10_000, direction: 'OVER', target: 5000, idempotencyKey: 'key-bonus-stake-2' });
    expect(res2.status).toBe(201);
    const done = await ctx.prisma.playerBonus.findUniqueOrThrow({ where: { id: pb.id } });
    expect(done.status).toBe('COMPLETED');
    expect(res2.body.wallet.bonusBalanceMinor).toBe(0);
    expect(res2.body.wallet.balanceMinor).toBe(180_000);
    const release = await ctx.prisma.journalEntry.findFirst({ where: { type: 'BONUS_RELEASE', referenceId: res2.body.round.id } });
    expect(release).not.toBeNull();
  });

  it('awards loyalty points exactly once per round and upgrades tiers', async () => {
    const { agent, user } = await registerPlayer(ctx);
    const sessionId = await openSession(agent, 'harbor-dice');
    (rng as any).ints = [100];
    (rng as any).i = 0;
    const res = await agent.post('/games/dice/play').send({ sessionId, betMinor: 25_000, direction: 'OVER', target: 5000, idempotencyKey: 'key-loy-1' });
    expect(res.body.loyaltyPointsAwarded).toBe(25);
    const loyalty = await agent.get('/loyalty');
    expect(loyalty.body.points).toBe(25);
    expect(loyalty.body.tier).toBe('BRONZE');
    // replay of the same round must not award again
    await agent.post('/games/dice/play').send({ sessionId, betMinor: 25_000, direction: 'OVER', target: 5000, idempotencyKey: 'key-loy-1' });
    expect((await agent.get('/loyalty')).body.points).toBe(25);
    await ctx.prisma.loyaltyAccount.update({ where: { userId: user.id }, data: { lifetimePoints: 499n } });
    (rng as any).i = 0;
    await agent.post('/games/dice/play').send({ sessionId, betMinor: 10_000, direction: 'OVER', target: 5000, idempotencyKey: 'key-loy-2' });
    const after = await agent.get('/loyalty');
    expect(after.body.tier).toBe('SILVER');
    expect((await agent.get('/bonuses')).body.find((b: any) => b.definition.code === 'WELCOME_2000')).toBeTruthy();
  });
});
