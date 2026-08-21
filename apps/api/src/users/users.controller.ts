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

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
