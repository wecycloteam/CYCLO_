import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  // Optional because a Google-only account (no passwordHash yet) has nothing to confirm —
  // AuthService.changePassword only requires this when the user already has a password set.
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  newPassword: string;
}
