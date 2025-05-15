import { createStaff, createTestApp, registerPlayer, resetDb, seedBasics, type TestContext } from '../helpers';

describe('auth & authorization (integration)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    await seedBasics(ctx);
  });
  afterAll(() => ctx.close());

  it('registers, returns the user and sets httpOnly cookies; duplicate e-mail is rejected', async () => {
    const agent = ctx.http();
    const res = await agent.post('/auth/register').send({ email: 'Alice@Test.dev', username: 'alice', password: 'Passw0rd!', acceptTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'alice@test.dev', username: 'alice', role: 'PLAYER', status: 'ACTIVE' });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('sh_access=') && /HttpOnly/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith('sh_refresh='))).toBe(true);
    const dup = await ctx.http().post('/auth/register').send({ email: 'alice@test.dev', username: 'alice2', password: 'Passw0rd!', acceptTerms: true });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');
    const weak = await ctx.http().post('/auth/register').send({ email: 'b@test.dev', username: 'bob', password: 'short', acceptTerms: true });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with e-mail or username, rejects bad passwords, exposes /auth/me and logs out', async () => {
    const agent = ctx.http();
    const bad = await agent.post('/auth/login').send({ identifier: 'alice', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('INVALID_CREDENTIALS');
    const ok = await agent.post('/auth/login').send({ identifier: 'ALICE', password: 'Passw0rd!' });
    expect(ok.status).toBe(200);
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('alice');
    await agent.post('/auth/logout');
    const after = await agent.get('/auth/me');
    expect(after.status).toBe(401);
  });

  it('rotates refresh tokens and rejects a reused one', async () => {
    const agent = ctx.http();
    const login = await agent.post('/auth/login').send({ identifier: 'alice', password: 'Passw0rd!' });
    const oldRefresh = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sh_refresh='))!.split(';')[0].split('=')[1];
    const r1 = await agent.post('/auth/refresh');
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();
    const reused = await ctx.http().post('/auth/refresh').set('Cookie', `sh_refresh=${oldRefresh}`);
    expect(reused.status).toBe(401);
  });

  it('accepts Bearer tokens and rejects tampered ones', async () => {
    const { accessToken } = await registerPlayer(ctx);
    const ok = await ctx.http().get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);
    const bad = await ctx.http().get('/auth/me').set('Authorization', `Bearer ${accessToken.slice(0, -2)}xx`);
    expect(bad.status).toBe(401);
  });

  it('enforces role-based access: players are blocked, support reads, operator mutates, only admin adjusts money', async () => {
    const player = await registerPlayer(ctx);
    const support = await createStaff(ctx, 'SUPPORT');
    const operator = await createStaff(ctx, 'OPERATOR');
    const admin = await createStaff(ctx, 'ADMIN');
    expect((await player.agent.get('/admin/dashboard')).status).toBe(403);
    expect((await ctx.http().get('/admin/dashboard')).status).toBe(401);
    expect((await support.agent.get('/admin/dashboard')).status).toBe(200);
    expect((await support.agent.get('/admin/players')).status).toBe(200);
    const suspendBySupport = await support.agent.patch(`/admin/players/${player.user.id}/status`).send({ status: 'SUSPENDED', reason: 'testing suspension' });
    expect(suspendBySupport.status).toBe(403);
    const suspendByOperator = await operator.agent.patch(`/admin/players/${player.user.id}/status`).send({ status: 'SUSPENDED', reason: 'testing suspension' });
    expect(suspendByOperator.status).toBe(200);
    expect(suspendByOperator.body.status).toBe('SUSPENDED');
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'player.status.suspended', targetId: player.user.id } });
    expect(audit?.actorId).toBe(operator.user.id);
    const adjustByOperator = await operator.agent.post(`/admin/players/${player.user.id}/wallet/adjust`).send({ amountMinor: 1000, reason: 'test' });
    expect(adjustByOperator.status).toBe(403);
    const adjustByAdmin = await admin.agent.post(`/admin/players/${player.user.id}/wallet/adjust`).send({ amountMinor: 1000, reason: 'test' });
    expect(adjustByAdmin.status).toBe(201);
    // operators cannot touch accounts of equal or higher rank
    const demote = await operator.agent.patch(`/admin/players/${admin.user.id}/status`).send({ status: 'SUSPENDED', reason: 'nope nope' });
    expect(demote.status).toBe(403);
    // a role sent by the client is ignored: the token decides
    const spoof = await player.agent.get('/admin/dashboard').set('x-role', 'ADMIN').send();
    expect(spoof.status).toBe(403);
  });

  it('refuses demo reset for suspended accounts and keeps a suspended user out of gameplay', async () => {
    const { agent, user } = await registerPlayer(ctx);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    expect((await agent.post('/wallet/reset')).status).toBe(403);
    expect((await agent.post('/games/sessions').send({ gameSlug: 'harbor-dice' })).status).toBe(403);
  });
});
