import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AssetRefDto } from '@/modules/categories/dto/asset-ref.dto';

export class CatalogueAssetDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty({ description: 'Cloudinary public_id of the raw, authenticated resource.' })
  @IsString()
  publicId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  pageCount?: number;
}

export class CreateCatalogueFileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: CatalogueAssetDto })
  @ValidateNested()
  @Type(() => CatalogueAssetDto)
  file: CatalogueAssetDto;

  @ApiPropertyOptional({ type: AssetRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetRefDto)
  coverImage?: AssetRefDto;

  @ApiProperty({ example: '2026-Q1' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresLead?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

/** `file` is excluded: replacing the PDF means uploading a new record. */
export class UpdateCatalogueFileDto extends PartialType(CreateCatalogueFileDto) {}

/**
 * The lead form (PROJECT_PLAN.md §9.7).
 *
 * Deliberately short — four fields and a consent box. Every extra field on a
 * gate like this measurably costs completions.
 */
export class CatalogueDownloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter your full name.' })
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(200)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Enter a contact phone number.' })
  @MaxLength(40)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter your company name.' })
  @MaxLength(160)
  company: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turnstileToken?: string;

  /** Honeypot. Must be empty. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;
}

export class CatalogueLeadQueryDto {
  @ApiPropertyOptional({ description: 'Name, company or email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
