import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AssetRefDto, SeoMetaDto } from '@/modules/categories/dto/asset-ref.dto';

export class CreateBrandDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ required: false, type: AssetRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetRefDto)
  logo?: AssetRefDto;

  @ApiProperty({ required: false, type: AssetRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetRefDto)
  banner?: AssetRefDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

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
