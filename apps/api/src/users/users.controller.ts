import { Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangePasswordSchema, UpdateProfileSchema, type ChangePasswordInput, type UpdateProfileInput } from '@spinharbor/contracts';
import { AuthPrincipal, CurrentUser } from '../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../common/zod/zod.decorators';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  me(@CurrentUser() user: AuthPrincipal) {
    return this.users.getMe(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update profile settings' })
  @ApiZodBody(UpdateProfileSchema)
  updateProfile(@CurrentUser() user: AuthPrincipal, @ZodBody(UpdateProfileSchema) body: UpdateProfileInput) {
    return this.users.updateProfile(user.id, body);
  }

  @Post('me/password')
  @ApiOperation({ summary: 'Change password' })
  @ApiZodBody(ChangePasswordSchema)
  changePassword(@CurrentUser() user: AuthPrincipal, @ZodBody(ChangePasswordSchema) body: ChangePasswordInput) {
    return this.users.changePassword(user.id, body);
  }
}
