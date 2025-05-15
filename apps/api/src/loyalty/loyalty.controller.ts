import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser } from '../common/decorators/auth.decorators';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiCookieAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}
  @Get()
  @ApiOperation({ summary: 'Loyalty tier, points and progress' })
  status(@CurrentUser() user: AuthPrincipal) {
    return this.loyalty.status(user.id);
  }
}
