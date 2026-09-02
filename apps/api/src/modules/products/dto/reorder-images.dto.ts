import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ReorderImagesDto {
  @ApiProperty({
    type: [String],
    description: 'Every publicId currently on the product, in the new order.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  publicIds: string[];
}
