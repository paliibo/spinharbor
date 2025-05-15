import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@spinharbor/database';
import { AuthPrincipal, ROLE_RANK, ROLES_KEY } from '../decorators/auth.decorators';

/** Server-side role check; the role always comes from the verified token, never the client. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user: AuthPrincipal | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    const minRank = Math.min(...roles.map((r) => ROLE_RANK[r]));
    if (ROLE_RANK[user.role] < minRank) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return true;
  }
}
