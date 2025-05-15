import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@spinharbor/database';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../config/env';
import type { AuthPrincipal } from '../common/decorators/auth.decorators';

interface AccessClaims {
  sub: string;
  role: UserRole;
  sid: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTtl(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }
  get refreshTtl(): number {
    return this.config.get('JWT_REFRESH_TTL_SECONDS');
  }

  signAccess(p: AuthPrincipal): string {
    const claims: AccessClaims = { sub: p.id, role: p.role, sid: p.sessionId };
    return this.jwt.sign(claims, { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: this.accessTtl });
  }

  async verifyAccess(token: string): Promise<AuthPrincipal> {
    const c = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
    return { id: c.sub, role: c.role, sessionId: c.sid };
  }

  /** Opaque refresh token; only its SHA-256 is persisted. */
  generateRefresh(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefresh(token) };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
