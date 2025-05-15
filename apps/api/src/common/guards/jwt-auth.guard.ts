import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenService } from '../../auth/token.service';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

export const ACCESS_COOKIE = 'sh_access';
export const REFRESH_COOKIE = 'sh_refresh';

export function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req as any).cookies?.[ACCESS_COOKIE];
  return typeof cookie === 'string' ? cookie : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
    }
    try {
      (req as any).user = await this.tokens.verifyAccess(token);
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Session expired or invalid' });
    }
  }
}
