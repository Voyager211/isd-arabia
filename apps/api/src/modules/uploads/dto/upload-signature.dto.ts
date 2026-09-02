import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';

import type { UploadFolder } from '@isd/shared-types';

const FOLDERS: UploadFolder[] = [
  'products',
  'categories',
  'brands',
  'industries',
  'banners',
  'catalogue',
];

export class UploadSignatureDto {
  @ApiProperty({ enum: FOLDERS })
  @IsIn(FOLDERS, { message: 'Unknown upload folder.' })
  folder: UploadFolder;

  @ApiProperty({ enum: ['image', 'raw'] })
  @IsIn(['image', 'raw'])
  resourceType: 'image' | 'raw';

  /** Scopes product images to /products/<productId>/ (PROJECT_PLAN.md §13.2). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  productId?: string;
}
