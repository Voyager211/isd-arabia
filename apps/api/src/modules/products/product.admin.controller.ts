import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductListQueryDto } from './dto/product-list-query.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';

@ApiTags('Admin — products')
@Controller('admin/products')
export class ProductAdminController {
  constructor(private readonly products: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated product list, filterable by category, brand and status' })
  async list(@Query() query: ProductListQueryDto) {
    return this.products.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full record for the edit form' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.products.findByIdForAdmin(id);
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — Cloudinary assets are kept, the action is reversible' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.products.remove(id);
  }

  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Reorder images; index 0 becomes the primary' })
  async reorderImages(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: ReorderImagesDto) {
    return this.products.reorderImages(id, dto.publicIds);
  }

  @Delete(':id/images/:publicId')
  @ApiOperation({ summary: 'Remove an image and destroy it in Cloudinary — permanent' })
  async removeImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('publicId') publicId: string,
  ) {
    return this.products.removeImage(id, decodeURIComponent(publicId));
  }
}
