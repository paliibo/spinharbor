import { Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginSchema, RegisterSchema, type LoginInput, type RegisterInput } from '@spinharbor/contracts';
import type { Request, Response } from 'express';
import { AuthPrincipal, CurrentUser, Public } from '../common/decorators/auth.decorators';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../common/guards/jwt-auth.guard';
import { clientIp } from '../common/utils/ip';
import { ApiZodBody, ZodBody } from '../common/zod/zod.decorators';
import type { Env } from '../config/env';
import { UsersService } from '../users/users.service';
import { AuthService, IssuedTokens } from './auth.service';
import { TokenService } from './token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create a demo player account (10,000 demo credits)' })
  @ApiZodBody(RegisterSchema)
  async register(@ZodBody(RegisterSchema) body: RegisterInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(body, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
    this.setCookies(res, result);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with e-mail or username' })
  @ApiZodBody(LoginSchema)
  async login(@ZodBody(LoginSchema) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
    this.setCookies(res, result);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.[REFRESH_COOKIE] ?? (req.body as any)?.refreshToken;
    if (!token) throw new UnauthorizedException({ code: 'REFRESH_MISSING', message: 'No refresh token' });
    const result = await this.auth.refresh(token, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
    this.setCookies(res, result);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: await this.users.getMe(result.principal.id) };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: AuthPrincipal, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user);
    this.clearCookies(res);
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthPrincipal) {
    return this.users.getMe(user.id);
  }

  private setCookies(res: Response, t: IssuedTokens) {
    const secure = this.config.get('COOKIE_SECURE');
    res.cookie(ACCESS_COOKIE, t.accessToken, { httpOnly: true, sameSite: 'lax', secure, maxAge: t.expiresIn * 1000, path: '/' });
    res.cookie(REFRESH_COOKIE, t.refreshToken, { httpOnly: true, sameSite: 'lax', secure, maxAge: this.tokens.refreshTtl * 1000, path: '/' });
  }
  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
