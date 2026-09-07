import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { QuotationStatus } from '@isd/shared-types';
import { QUOTATION_STATUSES } from '@isd/shared-types';

export class QuotationListQueryDto {
  /** Repeated or comma-separated, matching the multi-select filter. */
  @ApiPropertyOptional({ enum: QUOTATION_STATUSES, isArray: true })
  @IsOptional()
  status?: string | string[];

  @ApiPropertyOptional({ description: 'Quote number, company, contact name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateQuotationStatusDto {
  @ApiProperty({ enum: QUOTATION_STATUSES })
  @IsIn(QUOTATION_STATUSES)
  status: QuotationStatus;

  @ApiPropertyOptional({ description: 'Recorded against the status change in the history.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AddQuotationNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Enter a note.' })
  @MaxLength(4000)
  note: string;
}
