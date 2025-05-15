import { Controller, Get, Post, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CrashCashoutSchema, CrashPlaceBetSchema, type CrashCashoutInput, type CrashPlaceBetInput } from '@spinharbor/contracts';
import { AuthPrincipal, CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { Idempotent, IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ApiZodBody, ZodBody } from '../../common/zod/zod.decorators';
import { CrashService } from './crash.service';

@ApiTags('crash')
@Controller('games/crash')
export class CrashController {
  constructor(private readonly crash: CrashService) {}

  @Public()
  @Get('state')
  @ApiOperation({ summary: 'Current crash round snapshot (server time included)' })
  state() {
    return this.crash.snapshot();
  }

  @Public()
  @Get('history')
  history() {
    return this.crash.history();
  }

  @Get('my-bets')
  @ApiCookieAuth()
  myBets(@CurrentUser() user: AuthPrincipal) {
    return this.crash.myBets(user.id);
  }

  @Post('bet')
  @ApiCookieAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('crash.bet')
  @ApiOperation({ summary: 'Place a bet while betting is open (auto cash-out recorded now)' })
  @ApiZodBody(CrashPlaceBetSchema)
  bet(@CurrentUser() user: AuthPrincipal, @ZodBody(CrashPlaceBetSchema) body: CrashPlaceBetInput) {
    return this.crash.placeBet(user, body);
  }

  @Post('cashout')
  @ApiCookieAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cash out at the current server multiplier' })
  @ApiZodBody(CrashCashoutSchema)
  cashout(@CurrentUser() user: AuthPrincipal, @ZodBody(CrashCashoutSchema) body: CrashCashoutInput) {
    return this.crash.cashout(user, body.roundId);
  }
}
