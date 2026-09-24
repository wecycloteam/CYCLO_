import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  start(@CurrentUser() principal: CurrentUserPayload, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(principal.userId, dto);
  }

  @Get('conversations')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.chat.listMine(principal.userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.chat.getMessages(principal.userId, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(principal.userId, id, dto.body);
  }

  @Patch('conversations/:id/read')
  markRead(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.chat.markRead(principal.userId, id);
  }
}
