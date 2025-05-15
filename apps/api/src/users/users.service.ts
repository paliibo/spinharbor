import { Injectable } from '@nestjs/common';
import type { AuthUserDto, ChangePasswordInput, UpdateProfileInput } from '@spinharbor/contracts';
import type { User } from '@spinharbor/database';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService, Tx } from '../common/prisma/prisma.service';

const PLAY_BLOCKING: User['status'][] = ['SUSPENDED', 'COOLING_OFF', 'SELF_EXCLUDED', 'CLOSED'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(userId: string): Promise<AuthUserDto> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, loyalty: true } });
    const user = await this.restoreExpiredRestriction(u);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      statusUntil: user.statusUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      profile: {
        displayName: user.profile?.displayName ?? user.username,
        avatarSeed: user.profile?.avatarSeed ?? user.username,
        country: user.profile?.country ?? 'XX',
        soundEnabled: user.profile?.soundEnabled ?? true,
        sessionReminderMinutes: user.profile?.sessionReminderMinutes ?? 60,
      },
      loyalty: {
        tier: user.loyalty?.tier ?? 'BRONZE',
        points: Number(user.loyalty?.points ?? 0n),
        lifetimePoints: Number(user.loyalty?.lifetimePoints ?? 0n),
      },
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    await this.prisma.playerProfile.update({ where: { userId }, data: input });
    return this.getMe(userId);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw Errors.badRequest('INVALID_PASSWORD', 'Current password is incorrect');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(input.newPassword) } });
      await this.audit.log(tx, { actorId: userId, actorRole: user.role, action: 'user.password_changed', targetType: 'user', targetId: userId });
    });
    return { ok: true };
  }

  /**
   * Authoritative gameplay gate: reads the *current* status from the DB (never the token) and
   * clears expired cooling-off / self-exclusion windows. Throws for restricted accounts.
   */
  async assertCanPlay(tx: Tx, userId: string): Promise<User> {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const current = await this.restoreExpiredRestriction(user, tx);
    if (PLAY_BLOCKING.includes(current.status)) throw Errors.accountRestricted(current.status, current.statusUntil);
    return current;
  }

  private async restoreExpiredRestriction<T extends User>(user: T, tx: Tx | PrismaService = this.prisma): Promise<T> {
    if ((user.status === 'COOLING_OFF' || user.status === 'SELF_EXCLUDED') && user.statusUntil && user.statusUntil <= new Date()) {
      const updated = await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', statusUntil: null, statusReason: null } });
      await this.audit.log(tx as Tx, { actorId: null, action: 'user.restriction_expired', targetType: 'user', targetId: user.id, metadata: { previous: user.status } });
      return { ...user, ...updated };
    }
    return user;
  }
}
