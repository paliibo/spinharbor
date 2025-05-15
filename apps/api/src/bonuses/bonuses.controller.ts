import { Controller, Get, Post, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClaimBonusSchema } from '@spinharbor/contracts';
import { Throttle } from '@nestjs/throttler';
import { AuthPrincipal, CurrentUser, Public } from '../common/decorators/auth.decorators';
import { Idempotent, IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { ApiZodBody, ZodBody } from '../common/zod/zod.decorators';
import { BonusesService } from './bonuses.service';

@ApiTags('bonuses')
@Controller()
export class BonusesController {
  constructor(private readonly bonuses: BonusesService) {}

  @Public()
  @Get('promotions')
  @ApiOperation({ summary: 'Active promotions' })
  promotions() {
    return this.bonuses.promotions();
  }

  @Get('bonuses')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Bonus definitions with eligibility for the current player' })
  eligibility(@CurrentUser() user: AuthPrincipal) {
    return this.bonuses.eligibility(user.id);
  }

  @Get('bonuses/history')
  @ApiCookieAuth()
  history(@CurrentUser() user: AuthPrincipal) {
    return this.bonuses.history(user.id);
  }

  @Post('bonuses/claim')
  @ApiCookieAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('bonus.claim')
  @ApiOperation({ summary: 'Claim a bonus by code (duplicate-safe)' })
  @ApiZodBody(ClaimBonusSchema)
  claim(@CurrentUser() user: AuthPrincipal, @ZodBody(ClaimBonusSchema) body: { code: string }) {
    return this.bonuses.claim(user, body.code);
  }
}
