import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import type { ProductAvailability, ProductUnit } from '@isd/shared-types';
import { PRODUCT_AVAILABILITY, PRODUCT_UNITS } from '@isd/shared-types';

import { AssetRefDto, SeoMetaDto } from '@/modules/categories/dto/asset-ref.dto';

export class SpecificationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value: string;
}

export class ProductAttachmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsString()
  publicId: string;
}

/**
 * Note what is absent: there is no price field, and none should be added.
 * This is a quote-only platform (PROJECT_PLAN.md §7.5).
 */
export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  slug?: string;

  @ApiProperty({ description: 'Part number. Unique, stored uppercase.' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sku: string;

  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  /** Rich text from TipTap. Sanitised server-side before it is persisted. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  keyFeatures?: string[];

  @ApiProperty({ required: false, type: [SpecificationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications?: SpecificationDto[];

  @ApiProperty({ required: false, type: [AssetRefDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssetRefDto)
  images?: AssetRefDto[];

  @ApiProperty({ required: false, type: [ProductAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductAttachmentDto)
  documents?: ProductAttachmentDto[];

  @ApiProperty({ description: 'Leaf category only — enforced by the service.' })
  @IsMongoId()
  category: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsMongoId()
  brand?: string | null;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true })
  industries?: string[];

  @ApiProperty({ required: false, enum: PRODUCT_UNITS })
  @IsOptional()
  @IsIn(PRODUCT_UNITS)
  unit?: ProductUnit;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;

  @ApiProperty({ required: false, enum: PRODUCT_AVAILABILITY })
  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITY)
  availability?: ProductAvailability;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty({ required: false, type: SeoMetaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoMetaDto)
  seo?: SeoMetaDto;
}
