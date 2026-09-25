import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.notifications.listMine(principal.userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() principal: CurrentUserPayload) {
    return this.notifications.unreadCount(principal.userId).then((count) => ({ count }));
  }

  @Post(':id/read')
  markRead(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.notifications.markRead(principal.userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() principal: CurrentUserPayload) {
    return this.notifications.markAllRead(principal.userId);
  }
}
