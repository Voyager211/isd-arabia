import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AssetRefDto, SeoMetaDto } from './asset-ref.dto';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /**
   * Optional on create — the service generates it from the name and
   * de-duplicates. Sent explicitly only when the admin overrides it.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, type: AssetRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetRefDto)
  image?: AssetRefDto;

  @ApiProperty({ required: false, type: AssetRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetRefDto)
  banner?: AssetRefDto;

  /**
   * `null` means a root category. `level` and `ancestors` are derived from
   * this by the service and are never accepted from the client — a client that
   * could set `level` could put a category at depth 7.
   */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsMongoId()
  parent?: string | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, type: SeoMetaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoMetaDto)
  seo?: SeoMetaDto;
}
