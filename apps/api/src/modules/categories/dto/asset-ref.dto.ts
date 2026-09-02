import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Cloudinary asset reference as it arrives from the admin (PROJECT_PLAN.md §7.1).
 *
 * The browser uploads directly to Cloudinary and posts these references back,
 * so the API never handles the file bytes.
 */
export class AssetRefDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty({ description: 'Required — deletion needs it.' })
  @IsString()
  publicId: string;

  @ApiProperty({ description: 'Required on images; the admin uploader enforces it.' })
  @IsString()
  @MaxLength(200)
  alt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  height?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

/** Embedded SEO metadata. Lengths match what search engines actually render. */
export class SeoMetaDto {
  @ApiProperty({ required: false, maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  metaTitle?: string;

  @ApiProperty({ required: false, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ogImage?: string;
}

/** Re-exported for DTOs that nest an asset, so the decorators stay in one place. */
export function NestedAsset() {
  return [ValidateNested(), Type(() => AssetRefDto)] as const;
}
