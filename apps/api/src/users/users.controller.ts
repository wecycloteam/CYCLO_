import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, SELF_SWITCHABLE_ROLES } from './dto/update-profile.dto';

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

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@CurrentUser() principal: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    // Only a plain household/collector account may self-switch "mode" — a business,
    // recycler, authority, or (critically) admin account is never silently changed here,
    // since an admin who lost their own role this way would have no way back in.
    if (dto.role) {
      const current = await this.users.findById(principal.userId);
      if (!current || !SELF_SWITCHABLE_ROLES.includes(current.role as (typeof SELF_SWITCHABLE_ROLES)[number])) {
        throw new BadRequestException('This account cannot switch modes here.');
      }
    }
    if (dto.phone) {
      const existingPhone = await this.users.findByPhone(dto.phone);
      if (existingPhone && existingPhone.id !== principal.userId) {
        throw new BadRequestException('An account with this phone number already exists.');
      }
    }
    if (dto.username) {
      const existingUsername = await this.users.findByUsername(dto.username);
      if (existingUsername && existingUsername.id !== principal.userId) {
        throw new BadRequestException('That username is already taken.');
      }
    }

    const user = await this.users.updateProfile(principal.userId, {
      name: dto.name?.trim(),
      phone: dto.phone,
      username: dto.username,
      avatarUrl: dto.avatarUrl,
      role: dto.role,
    });
    const { passwordHash: _passwordHash, googleId: _googleId, ...safeUser } = user;
    return safeUser;
  }
}
