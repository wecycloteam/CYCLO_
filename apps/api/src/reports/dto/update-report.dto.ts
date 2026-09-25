import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const;

export class UpdateReportDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  investigationNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolution?: string;
}
