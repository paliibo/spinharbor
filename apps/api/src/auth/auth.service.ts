import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginInput, RegisterInput } from '@spinharbor/contracts';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(input: RegisterInput, meta: { ip?: string; userAgent?: string }) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username: { equals: input.username, mode: 'insensitive' } }] },
      select: { email: true },
    });
    if (existing) {
      throw Errors.conflict(existing.email === email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', existing.email === email ? 'E-mail already registered' : 'Username already taken');
    }
    const passwordHash = await argon2.hash(input.password);
    const initialCredits = this.config.get('INITIAL_DEMO_CREDITS');

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          username: input.username,
          passwordHash,
          profile: { create: { displayName: input.displayName ?? input.username, avatarSeed: input.username } },
          loyalty: { create: {} },
        },
      });
      await this.wallet.openWallet(tx, u.id, initialCredits);
      await this.audit.log(tx, { actorId: u.id, actorRole: u.role, action: 'auth.register', targetType: 'user', targetId: u.id, ip: meta.ip });
      return u;
    });

    const issued = await this.issueSession({ id: user.id, role: user.role }, meta);
    return { user: await this.users.getMe(user.id), ...issued };
  }

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
    const identifier = input.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: identifier.includes('@') ? { email: identifier.toLowerCase() } : { username: { equals: identifier, mode: 'insensitive' } },
    });
    const invalid = new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid e-mail/username or password' });
    if (!user) {
      // burn comparable time to limit user enumeration via timing
      await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNoZmFrZWhhc2g', input.password).catch(() => false);
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw invalid;
    if (user.status === 'CLOSED') throw Errors.accountRestricted('CLOSED', null);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const issued = await this.issueSession({ id: user.id, role: user.role }, meta);
    await this.audit.log(null, { actorId: user.id, actorRole: user.role, action: 'auth.login', targetType: 'user', targetId: user.id, ip: meta.ip });
    return { user: await this.users.getMe(user.id), ...issued };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens & { principal: AuthPrincipal }> {
    const hash = this.tokens.hashRefresh(refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: hash }, include: { user: { select: { id: true, role: true, status: true } } } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Session expired, please sign in again' });
    }
    if (session.user.status === 'CLOSED') throw Errors.accountRestricted('CLOSED', null);
    // Rotate: the old refresh token is invalidated and a new one is issued for the same session.
    const next = this.tokens.generateRefresh();
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: next.hash, lastUsedAt: new Date(), expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000), ipAddress: meta.ip, userAgent: meta.userAgent?.slice(0, 250) },
    });
    const principal: AuthPrincipal = { id: session.user.id, role: session.user.role, sessionId: session.id };
    return { principal, accessToken: this.tokens.signAccess(principal), refreshToken: next.token, expiresIn: this.tokens.accessTtl };
  }

  async logout(principal: AuthPrincipal) {
    await this.prisma.userSession.updateMany({ where: { id: principal.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async logoutAll(userId: string) {
    await this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueSession(user: { id: string; role: AuthPrincipal['role'] }, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    const refresh = this.tokens.generateRefresh();
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: refresh.hash,
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 250),
        expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000),
      },
    });
    const principal: AuthPrincipal = { id: user.id, role: user.role, sessionId: session.id };
    return { accessToken: this.tokens.signAccess(principal), refreshToken: refresh.token, expiresIn: this.tokens.accessTtl };
  }
}
