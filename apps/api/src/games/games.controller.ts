import { Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CreateGameSessionSchema,
  PlayDiceSchema,
  PlayRouletteSchema,
  PlaySlotsSchema,
  RoundListQuerySchema,
  type CreateGameSessionInput,
  type PlayDiceInput,
  type PlayRouletteInput,
  type PlaySlotsInput,
  type RoundListQuery,
} from '@spinharbor/contracts';
import { AuthPrincipal, CurrentUser, Public } from '../common/decorators/auth.decorators';
import { Idempotent, IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod/zod.decorators';
import { GameplayService } from './gameplay.service';
import { RoundsService } from './rounds.service';
import { SessionsService, engineConfig } from './sessions.service';

@ApiTags('games')
@ApiCookieAuth()
@Controller('games')
export class GamesController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly gameplay: GameplayService,
    private readonly rounds: RoundsService,
  ) {}

  @Public()
  @Get('config/:engine')
  @ApiOperation({ summary: 'Public engine configuration (paytable, odds, bet options)' })
  config(@Param('engine') engine: string) {
    return engineConfig(engine.toUpperCase() as any);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Open (or resume) a game session' })
  @ApiZodBody(CreateGameSessionSchema)
  createSession(@CurrentUser() user: AuthPrincipal, @ZodBody(CreateGameSessionSchema) body: CreateGameSessionInput) {
    return this.sessions.create(user, body.gameSlug);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.sessions.get(user, id);
  }

  @Get('sessions/:id/stats')
  sessionStats(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.rounds.sessionStats(user.id, id);
  }

  @Post('sessions/:id/close')
  closeSession(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.sessions.close(user, id);
  }

  @Post('slots/play')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('slots.play')
  @ApiOperation({ summary: 'Spin the slot machine (server-side outcome)' })
  @ApiZodBody(PlaySlotsSchema)
  playSlots(@CurrentUser() user: AuthPrincipal, @ZodBody(PlaySlotsSchema) body: PlaySlotsInput) {
    return this.gameplay.playInstant({ principal: user, sessionId: body.sessionId, engine: 'SLOTS', stakeMinor: BigInt(body.betMinor), input: {}, idempotencyKey: body.idempotencyKey });
  }

  @Post('dice/play')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('dice.play')
  @ApiOperation({ summary: 'Roll the dice (server validates target and computes payout)' })
  @ApiZodBody(PlayDiceSchema)
  playDice(@CurrentUser() user: AuthPrincipal, @ZodBody(PlayDiceSchema) body: PlayDiceInput) {
    return this.gameplay.playInstant({ principal: user, sessionId: body.sessionId, engine: 'DICE', stakeMinor: BigInt(body.betMinor), input: { direction: body.direction, target: body.target }, idempotencyKey: body.idempotencyKey });
  }

  @Post('roulette/play')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent('roulette.play')
  @ApiOperation({ summary: 'Spin the roulette wheel with a set of bets' })
  @ApiZodBody(PlayRouletteSchema)
  playRoulette(@CurrentUser() user: AuthPrincipal, @ZodBody(PlayRouletteSchema) body: PlayRouletteInput) {
    const stake = body.bets.reduce((a, b) => a + BigInt(b.amountMinor), 0n);
    return this.gameplay.playInstant({ principal: user, sessionId: body.sessionId, engine: 'ROULETTE', stakeMinor: stake, input: { bets: body.bets }, idempotencyKey: body.idempotencyKey });
  }

  @Get('rounds')
  @ApiOperation({ summary: 'My round history' })
  @ApiZodQuery(RoundListQuerySchema)
  listRounds(@CurrentUser() user: AuthPrincipal, @ZodQuery(RoundListQuerySchema) q: RoundListQuery) {
    return this.rounds.listMine(user.id, q);
  }

  @Get('rounds/:id')
  getRound(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.rounds.get(user, id);
  }
}
