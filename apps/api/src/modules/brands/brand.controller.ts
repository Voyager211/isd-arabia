import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { BrandService } from './brand.service';

@ApiTags('Catalogue — brands')
@Public()
@Controller('brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Active brands, ordered for the brand strip' })
  async list(@Query('active') active?: string) {
    return this.brands.findAll({ includeInactive: active === 'false' });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Single brand' })
  async findOne(@Param('slug') slug: string) {
    return this.brands.findBySlug(slug);
  }
}
