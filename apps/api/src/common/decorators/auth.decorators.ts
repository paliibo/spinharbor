import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@spinharbor/database';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Role hierarchy: a higher role implies the permissions of lower staff roles. */
export const ROLE_RANK: Record<UserRole, number> = { PLAYER: 0, SUPPORT: 1, OPERATOR: 2, ADMIN: 3 };

export interface AuthPrincipal {
  id: string;
  role: UserRole;
  sessionId: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
  return ctx.switchToHttp().getRequest().user;
});
