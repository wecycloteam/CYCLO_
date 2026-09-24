import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const E164 = /^\+[1-9]\d{7,14}$/;
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
// The two self-service "modes" a regular user can switch between from their own profile —
// household lists/sells material, collector accepts/completes pickup jobs (buys it). Other
// roles (business, recycler, authority, admin) need verification/org affiliation or admin
// action, so they're deliberately excluded from this self-switch.
export const SELF_SWITCHABLE_ROLES = ['household', 'collector'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678' })
  phone?: string;

  @IsOptional()
  @Matches(USERNAME, { message: 'username must be 3-20 characters: letters, numbers, underscore only.' })
  username?: string;

  // Data URL (base64) from the client's image picker — same size class as WasteListing
  // photos, so no separate upload endpoint/storage abstraction is needed for this either.
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(SELF_SWITCHABLE_ROLES)
  role?: (typeof SELF_SWITCHABLE_ROLES)[number];
}
