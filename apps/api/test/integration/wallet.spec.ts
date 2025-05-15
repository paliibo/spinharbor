import { JournalEntryType } from '@spinharbor/database';
import { DomainError } from '../../src/common/errors/domain.errors';
import { LedgerService } from '../../src/ledger/ledger.service';
import { WalletService } from '../../src/wallet/wallet.service';
import { createTestApp, registerPlayer, resetDb, seedBasics, type TestContext } from '../helpers';

describe('wallet & ledger (integration)', () => {
  let ctx: TestContext;
  let wallet: WalletService;
  let ledger: LedgerService;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    await seedBasics(ctx);
    wallet = ctx.app.get(WalletService);
    ledger = ctx.app.get(LedgerService);
  });
  afterAll(() => ctx.close());

  async function newPlayer() {
    const { user } = await registerPlayer(ctx);
    return user.id;
  }

  const debit = (userId: string, amount: bigint, key = `test-${Math.random()}`) =>
    ctx.prisma.$transaction((tx) => wallet.applyMovement(tx, { userId, type: 'STAKE', description: 'test stake', idempotencyKey: key, cashDeltaMinor: -amount, bonusDeltaMinor: 0n, houseAccount: 'HOUSE_GAMING' }));
  const credit = (userId: string, amount: bigint, key = `test-${Math.random()}`) =>
    ctx.prisma.$transaction((tx) => wallet.applyMovement(tx, { userId, type: 'PAYOUT', description: 'test payout', idempotencyKey: key, cashDeltaMinor: amount, bonusDeltaMinor: 0n, houseAccount: 'HOUSE_GAMING' }));

  it('funds a new wallet with the initial demo credits and a balanced INITIAL_FUNDING entry', async () => {
    const userId = await newPlayer();
    const w = await wallet.getWallet(userId);
    expect(w.balanceMinor).toBe(1_000_000);
    const r = await ledger.reconcileUser(userId);
    expect(r.ok).toBe(true);
  });

  it('debits and credits the wallet, keeping the journal and cached balance in sync', async () => {
    const userId = await newPlayer();
    const d = await debit(userId, 10_000n);
    expect(d.wallet.balanceMinor).toBe(990_000n);
    const c = await credit(userId, 25_000n);
    expect(c.wallet.balanceMinor).toBe(1_015_000n);
    const lines = await ctx.prisma.journalLine.findMany({ where: { entryId: c.entry!.id } });
    expect(lines.reduce((a, l) => a + l.amountMinor, 0n)).toBe(0n);
    const playerLine = lines.find((l) => l.balanceAfterMinor !== null && l.amountMinor === 25_000n)!;
    expect(playerLine.balanceAfterMinor).toBe(1_015_000n);
    expect((await ledger.reconcileUser(userId)).ok).toBe(true);
  });

  it('rejects a debit exceeding the balance (INSUFFICIENT_BALANCE) without writing anything', async () => {
    const userId = await newPlayer();
    const before = await ctx.prisma.journalEntry.count();
    await expect(debit(userId, 1_000_001n)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(await ctx.prisma.journalEntry.count()).toBe(before);
    expect((await wallet.getWallet(userId)).balanceMinor).toBe(1_000_000);
  });

  it('prevents concurrent double-spending via the row lock (only affordable debits succeed)', async () => {
    const userId = await newPlayer();
    // 15 concurrent debits of 100,000 against a 1,000,000 balance: exactly 10 may succeed.
    const results = await Promise.allSettled(Array.from({ length: 15 }, (_, i) => debit(userId, 100_000n, `conc-${userId}-${i}`)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toBe(10);
    expect(failed).toHaveLength(5);
    for (const f of failed) expect((f as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
    const w = await wallet.getWallet(userId);
    expect(w.balanceMinor).toBe(0);
    expect((await ledger.reconcileUser(userId)).ok).toBe(true);
  });

  it('is idempotent per entry key: the same movement cannot be posted twice', async () => {
    const userId = await newPlayer();
    await debit(userId, 500n, `dup-${userId}`);
    await expect(debit(userId, 500n, `dup-${userId}`)).rejects.toMatchObject({ code: 'P2002' });
    expect((await wallet.getWallet(userId)).balanceMinor).toBe(999_500);
  });

  it('rolls back the whole transaction when a later step fails', async () => {
    const userId = await newPlayer();
    await expect(
      ctx.prisma.$transaction(async (tx) => {
        await wallet.applyMovement(tx, { userId, type: 'STAKE', description: 'x', idempotencyKey: `rb-${userId}`, cashDeltaMinor: -1000n, bonusDeltaMinor: 0n, houseAccount: 'HOUSE_GAMING' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await wallet.getWallet(userId)).balanceMinor).toBe(1_000_000);
    expect(await ctx.prisma.journalEntry.findUnique({ where: { idempotencyKey: `rb-${userId}` } })).toBeNull();
  });

  it('refuses unbalanced journal entries and keeps the global journal at zero', async () => {
    const userId = await newPlayer();
    const w = await ctx.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    await expect(
      ctx.prisma.$transaction((tx) => ledger.postEntry(tx, { type: 'ADJUSTMENT' as JournalEntryType, description: 'bad', idempotencyKey: `bad-${userId}`, lines: [{ accountId: w.cashAccountId, amountMinor: 100n }, { accountId: ledger.houseAccountId('HOUSE_FUNDING'), amountMinor: -90n }] })),
    ).rejects.toThrow(/Unbalanced/);
    expect(await ledger.globalBalance()).toBe(0n);
  });

  it('reverses an adjustment with a compensating REVERSAL entry (history is never edited)', async () => {
    const userId = await newPlayer();
    const admin = { id: userId, role: 'ADMIN' as const, sessionId: 'x' };
    const adj = await wallet.adminAdjust(admin, userId, 5_000n, 'goodwill');
    expect((await wallet.getWallet(userId)).balanceMinor).toBe(1_005_000);
    await wallet.reverseEntry(admin, adj.entry!.id, 'mistake');
    expect((await wallet.getWallet(userId)).balanceMinor).toBe(1_000_000);
    await expect(wallet.reverseEntry(admin, adj.entry!.id, 'again')).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    const original = await ctx.prisma.journalEntry.findUniqueOrThrow({ where: { id: adj.entry!.id }, include: { lines: true, reversedBy: true } });
    expect(original.reversedBy).not.toBeNull();
    expect(original.lines.find((l) => l.amountMinor === 5_000n)).toBeTruthy();
    expect((await ledger.reconcileUser(userId)).ok).toBe(true);
  });

  it('demo reset restores the initial balance and is blocked by the daily top-up limit', async () => {
    const userId = await newPlayer();
    const principal = { id: userId, role: 'PLAYER' as const, sessionId: 'x' };
    await debit(userId, 400_000n);
    await ctx.prisma.playerLimit.create({ data: { userId, type: 'DAILY_TOPUP', value: 300_000n } });
    await expect(wallet.resetDemo(principal)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await ctx.prisma.playerLimit.deleteMany({ where: { userId } });
    const w = await wallet.resetDemo(principal);
    expect(w.balanceMinor).toBe(1_000_000);
    expect((await ledger.reconcileUser(userId)).ok).toBe(true);
  });
});
