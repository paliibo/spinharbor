import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser } from '../common/decorators/auth.decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const [items, unread] = await Promise.all([this.notifications.list(user.id), this.notifications.unreadCount(user.id)]);
    return { items, unread };
  }
  @Post('read')
  readAll(@CurrentUser() user: AuthPrincipal) {
    return this.notifications.markRead(user.id);
  }
  @Post(':id/read')
  readOne(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
