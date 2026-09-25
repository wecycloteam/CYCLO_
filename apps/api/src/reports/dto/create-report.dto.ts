import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const CATEGORIES = [
  'ACCOUNT',
  'LISTING',
  'PAYMENT',
  'COLLECTOR',
  'BUYER_RECYCLER',
  'CHAT',
  'MISINFORMATION',
  'FRAUDULENT_WASTE',
  'OTHER',
] as const;

const CONTEXTS = ['MARKETPLACE', 'CHAT', 'PICKUP', 'PAYMENT', 'OUTSIDE_APP'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
const CONTACT_PREFERENCES = ['IN_APP', 'EMAIL', 'PHONE'] as const;

export class CreateReportDto {
  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @IsString()
  @MinLength(10, { message: 'Please describe what happened in a bit more detail.' })
  @MaxLength(4000)
  description: string;

  @IsOptional()
  @IsString()
  reportedUsername?: string;

  @IsOptional()
  @IsString()
  reportedUserId?: string;

  @IsOptional()
  @IsString()
  relatedListingId?: string;

  @IsOptional()
  @IsString()
  relatedOrderId?: string;

  @IsOptional()
  @IsString()
  relatedTransactionId?: string;

  @IsOptional()
  @IsString()
  relatedPickupId?: string;

  @IsOptional()
  @IsString()
  relatedConversationId?: string;

  @IsOptional()
  @IsDateString()
  incidentAt?: string;

  @IsOptional()
  @IsIn(CONTEXTS)
  context?: (typeof CONTEXTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationArea?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @IsIn(SEVERITIES)
  severity: (typeof SEVERITIES)[number];

  @IsIn(CONTACT_PREFERENCES)
  contactPreference: (typeof CONTACT_PREFERENCES)[number];
}
