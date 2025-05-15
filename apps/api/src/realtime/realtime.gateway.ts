import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { AuthPrincipal, ROLE_RANK } from '../common/decorators/auth.decorators';
import { DomainEvents } from '../common/events/domain-events';
import { ACCESS_COOKIE } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { CrashService } from '../games/crash/crash.service';

interface SocketData {
  user?: AuthPrincipal;
  connectedAt: number;
  reminderMinutes: number;
  lastReminderMinute: number;
}

const RESTRICTED = new Set(['SUSPENDED', 'CLOSED', 'SELF_EXCLUDED', 'COOLING_OFF']);

/**
 * Socket.IO gateway. Connections are authenticated with the same JWT as HTTP (cookie or
 * handshake auth). Rooms: `user:<id>` (private wallet/account events), `crash` (public round
 * feed), `ops` (staff-only monitoring). All state originates from domain events published after
 * database commits, so a reconnecting client can always re-sync via REST/`crash:subscribe`.
 */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(RealtimeGateway.name);
  private reminderTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly tokens: TokenService,
    private readonly events: DomainEvents,
    private readonly prisma: PrismaService,
    private readonly crash: CrashService,
  ) {}

  onModuleInit() {
    this.events.subscribe('wallet.updated', (e) => {
      this.server.to(`user:${e.userId}`).emit('wallet:updated', { balanceMinor: Number(e.balanceMinor), bonusBalanceMinor: Number(e.bonusBalanceMinor), version: e.version, reason: e.reason });
    });
    this.events.subscribe('account.status', async (e) => {
      this.server.to(`user:${e.userId}`).emit('account:status', { status: e.status, statusUntil: e.statusUntil?.toISOString() ?? null, reason: e.reason });
      this.server.to('ops').emit('ops:activity', { kind: 'status', summary: `Account ${e.userId.slice(0, 8)} → ${e.status}`, at: new Date().toISOString(), data: e });
      // A restricted account must not keep an authenticated realtime channel open.
      if (RESTRICTED.has(e.status)) {
        const sockets = await this.server.in(`user:${e.userId}`).fetchSockets();
        for (const s of sockets) s.disconnect(true);
      }
    });
    this.events.subscribe('round.settled', (e) => {
      this.server.to(`user:${e.userId}`).emit('round:settled', { roundId: e.roundId, engine: e.engine, gameSlug: e.gameSlug, stakeMinor: Number(e.stakeMinor), payoutMinor: Number(e.payoutMinor) });
      this.server.to('ops').emit('ops:activity', {
        kind: 'round',
        summary: `${e.username} ${e.payoutMinor > e.stakeMinor ? 'won' : 'lost'} on ${e.gameName} (stake ${Number(e.stakeMinor) / 100}, payout ${Number(e.payoutMinor) / 100})`,
        at: new Date().toISOString(),
        data: { roundId: e.roundId, userId: e.userId, engine: e.engine, stakeMinor: Number(e.stakeMinor), payoutMinor: Number(e.payoutMinor) },
      });
    });
    this.events.subscribe('bonus.claimed', (e) => this.server.to('ops').emit('ops:activity', { kind: 'bonus', summary: `${e.username} claimed ${e.bonusName} (${Number(e.amountMinor) / 100})`, at: new Date().toISOString() }));
    this.events.subscribe('session.started', (e) => this.server.to('ops').emit('ops:activity', { kind: 'session', summary: `${e.username} opened ${e.gameName}`, at: new Date().toISOString(), data: { sessionId: e.sessionId, userId: e.userId } }));
    this.events.subscribe('crash.state', (e) => this.server.to('crash').emit('crash:state', e.round));
    this.events.subscribe('crash.tick', (e) => this.server.to('crash').volatile.emit('crash:tick', e));
    this.events.subscribe('crash.bet', (e) => this.server.to('crash').emit('crash:bet_placed', e));
    this.events.subscribe('crash.cashout', (e) => this.server.to('crash').emit('crash:cashed_out', e));
    this.events.subscribe('crash.crashed', (e) => this.server.to('crash').emit('crash:crashed', e));

    this.reminderTimer = setInterval(() => void this.sendSessionReminders(), 60_000);
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  async handleConnection(socket: Socket) {
    const token = this.extractToken(socket);
    const data = socket.data as SocketData;
    data.connectedAt = Date.now();
    data.reminderMinutes = 0;
    data.lastReminderMinute = 0;
    if (!token) return; // anonymous: may only watch the public crash feed
    try {
      const user = await this.tokens.verifyAccess(token);
      const db = await this.prisma.user.findUnique({ where: { id: user.id }, select: { status: true, profile: { select: { sessionReminderMinutes: true } } } });
      if (!db || db.status === 'CLOSED') {
        socket.disconnect(true);
        return;
      }
      data.user = user;
      data.reminderMinutes = db.profile?.sessionReminderMinutes ?? 60;
      await socket.join(`user:${user.id}`);
    } catch {
      socket.emit('error', { code: 'UNAUTHENTICATED' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: Socket) {
    // rooms are cleaned up automatically by socket.io
  }

  @SubscribeMessage('crash:subscribe')
  async crashSubscribe(@ConnectedSocket() socket: Socket) {
    await socket.join('crash');
    return this.crash.snapshot();
  }

  @SubscribeMessage('crash:unsubscribe')
  async crashUnsubscribe(@ConnectedSocket() socket: Socket) {
    await socket.leave('crash');
    return { ok: true };
  }

  @SubscribeMessage('ops:subscribe')
  async opsSubscribe(@ConnectedSocket() socket: Socket) {
    const user = (socket.data as SocketData).user;
    if (!user || ROLE_RANK[user.role] < ROLE_RANK.SUPPORT) return { ok: false, error: 'FORBIDDEN' };
    await socket.join('ops');
    return { ok: true };
  }

  private extractToken(socket: Socket): string | null {
    const auth = socket.handshake.auth?.token;
    if (typeof auth === 'string' && auth) return auth;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookies = socket.handshake.headers.cookie ? parseCookie(socket.handshake.headers.cookie) : {};
    return cookies[ACCESS_COOKIE] ?? null;
  }

  /** Responsible-gaming reminder: once every N minutes of continuous connection. */
  private async sendSessionReminders() {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const d = s.data as SocketData;
      if (!d.user || !d.reminderMinutes) continue;
      const minutes = Math.floor((Date.now() - d.connectedAt) / 60_000);
      if (minutes > 0 && minutes % d.reminderMinutes === 0 && d.lastReminderMinute !== minutes) {
        d.lastReminderMinute = minutes;
        s.emit('session:reminder', { minutesPlayed: minutes });
      }
    }
  }
}
