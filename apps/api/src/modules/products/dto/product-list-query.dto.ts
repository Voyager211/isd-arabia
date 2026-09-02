import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import type { ProductSort } from '@isd/shared-types';
import { PRODUCT_LIST_MAX_LIMIT, PRODUCT_SORTS } from '@isd/shared-types';

/**
 * Query parameters for `GET /products` (PROJECT_PLAN.md §8.1).
 *
 * Everything arrives as a string on the wire, so booleans and numbers are
 * transformed explicitly rather than relying on implicit conversion — the
 * global ValidationPipe has `enableImplicitConversion: false` precisely so
 * these coercions are visible and intentional.
 */
export class ProductListQueryDto {
  /** Slug(s). Matches `categoryPath`, so a parent returns all descendants. */
  @ApiPropertyOptional({ description: 'Category slug(s); repeated or comma-separated' })
  @IsOptional()
  category?: string | string[];

  @ApiPropertyOptional({ description: 'Brand slug(s)' })
  @IsOptional()
  brand?: string | string[];

  @ApiPropertyOptional({ description: 'Industry slug(s)' })
  @IsOptional()
  industry?: string | string[];

  @ApiPropertyOptional({ description: 'Full-text search across name, SKU and short description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  featured?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  newArrival?: boolean;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: PRODUCT_LIST_MAX_LIMIT, default: 24 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(PRODUCT_LIST_MAX_LIMIT)
  limit?: number;

  /** Admin listings only — the public endpoint always filters to active. */
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';
}
