import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';

@ApiTags('Admin — categories')
@Controller('admin/categories')
export class CategoryAdminController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Full tree including inactive categories' })
  async list(@Query('flat') flat?: string) {
    return flat === 'true' ? this.categories.getFlat(true) : this.categories.getTree(true);
  }

  /**
   * Declared before `:id` so the literal path is not captured by the dynamic
   * segment.
   */
  @Patch('reorder')
  @ApiOperation({ summary: 'Bulk displayOrder update' })
  async reorder(@Body() dto: ReorderCategoriesDto) {
    return this.categories.reorder(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single category for the edit form' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categories.findByIdForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — blocked when children or products remain' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categories.remove(id);
  }
}
