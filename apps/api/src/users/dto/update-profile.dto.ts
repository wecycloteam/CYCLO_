import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeTanzanianPhone } from '../../common/normalize-phone';

const E164 = /^\+[1-9]\d{7,14}$/;
const USERNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9_.]{1,18}[a-zA-Z0-9])?$/;
// The two self-service "modes" a regular user can switch between from their own profile —
// household lists/sells material, collector accepts/completes pickup jobs (buys it). Other
// roles (business, recycler, authority, admin) need verification/org affiliation or admin
// action, so they're deliberately excluded from this self-switch.
export const SELF_SWITCHABLE_ROLES = ['household', 'collector'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @MinLength(2)
  name?: string;

  // Accepts +255712345678 or the local 0712345678 form — normalized to E.164 before
  // validation, so the profile page always ends up storing/showing the same format.
  @IsOptional()
  @Transform(({ value }) => normalizeTanzanianPhone(value))
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678 (or start with 0, e.g. 0712345678)' })
  phone?: string;

  @IsOptional()
  @Matches(USERNAME, {
    message: 'username must be 3-20 characters: letters, numbers, underscore or full stop only (not at the start or end).',
  })
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
