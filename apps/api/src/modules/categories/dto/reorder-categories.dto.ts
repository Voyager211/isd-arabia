import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsMongoId, Min, ValidateNested } from 'class-validator';

export class CategoryOrderDto {
  @ApiProperty()
  @IsMongoId()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [CategoryOrderDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CategoryOrderDto)
  items: CategoryOrderDto[];
}
