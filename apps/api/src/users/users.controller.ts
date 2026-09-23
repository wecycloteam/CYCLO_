import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() principal: CurrentUserPayload) {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new NotFoundException('User not found.');

    // googleId is Google's internal account identifier — backend-only, never surfaced to
    // the client (it was briefly visible on the profile page via a since-fixed bug that
    // also leaked it into User.phone; this is the actual API-level fix for that class of
    // problem, not just the one field it happened to show up in).
    const { passwordHash: _passwordHash, googleId: _googleId, ...safeUser } = user;
    return safeUser;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/impact')
  impact(@CurrentUser() principal: CurrentUserPayload) {
    return this.users.impact(principal.userId);
  }
}
