import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('Admin — brands')
@Controller('admin/brands')
export class BrandAdminController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'All brands including inactive' })
  async list() {
    return this.brands.findAll({ includeInactive: true });
  }

  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.brands.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — blocked while products reference it' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.brands.remove(id);
  }
}
