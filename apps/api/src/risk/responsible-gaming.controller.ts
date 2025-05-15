import { Controller, Get, Post, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoolingOffSchema, SelfExcludeSchema, SetLimitSchema, type SetLimitInput } from '@spinharbor/contracts';
import { z } from 'zod';
import { AuthPrincipal, CurrentUser } from '../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../common/zod/zod.decorators';
import { ResponsibleGamingService } from './responsible-gaming.service';

@ApiTags('responsible-gaming')
@ApiCookieAuth()
@Controller('responsible-gaming')
export class ResponsibleGamingController {
  constructor(private readonly rg: ResponsibleGamingService) {}

  @Get()
  @ApiOperation({ summary: 'Current restrictions, limits and usage' })
  status(@CurrentUser() user: AuthPrincipal) {
    return this.rg.status(user.id);
  }

  @Put('limits')
  @ApiOperation({ summary: 'Set or remove a player limit' })
  @ApiZodBody(SetLimitSchema)
  setLimit(@CurrentUser() user: AuthPrincipal, @ZodBody(SetLimitSchema) body: SetLimitInput) {
    return this.rg.setLimit(user, body);
  }

  @Post('cooling-off')
  @ApiOperation({ summary: 'Start a voluntary cooling-off period (24h / 72h / 7d)' })
  @ApiZodBody(CoolingOffSchema)
  coolingOff(@CurrentUser() user: AuthPrincipal, @ZodBody(CoolingOffSchema) body: z.infer<typeof CoolingOffSchema>) {
    return this.rg.coolingOff(user, body.hours);
  }

  @Post('self-exclude')
  @ApiOperation({ summary: 'Self-exclude for 30/90/180 days or indefinitely' })
  @ApiZodBody(SelfExcludeSchema)
  selfExclude(@CurrentUser() user: AuthPrincipal, @ZodBody(SelfExcludeSchema) body: z.infer<typeof SelfExcludeSchema>) {
    return this.rg.selfExclude(user, body.days);
  }
}
