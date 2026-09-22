import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { ScanImageDto } from './dto/scan-image.dto';
import { ConfirmScanDto } from './dto/confirm-scan.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('scan')
  scan(@CurrentUser() principal: CurrentUserPayload, @Body() dto: ScanImageDto) {
    return this.ai.scan(principal.userId, dto);
  }

  @Patch('scans/:id/confirm')
  confirm(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: ConfirmScanDto) {
    return this.ai.confirm(principal.userId, id, dto.finalMaterialId);
  }

  @Get('scans')
  history(@CurrentUser() principal: CurrentUserPayload) {
    return this.ai.history(principal.userId);
  }

  // NEW: Chat Assistant Route for Help & Guidance
  @Post('chat')
  chat(
    @CurrentUser() principal: CurrentUserPayload,
    @Body('message') message: string,
    @Body('history') history?: { role: 'user' | 'model'; parts: string }[],
  ) {
    if (!message) {
      throw new BadRequestException('Message is required.');
    }
    return this.ai.chatGuidance(message, history);
  }
}