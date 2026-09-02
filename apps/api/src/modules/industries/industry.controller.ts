import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { IndustryService } from './industry.service';

@ApiTags('Catalogue — industries')
@Public()
@Controller('industries')
export class IndustryController {
  constructor(private readonly industries: IndustryService) {}

  @Get()
  @ApiOperation({ summary: 'Active industries' })
  async list() {
    return this.industries.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Single industry with its long-form content' })
  async findOne(@Param('slug') slug: string) {
    return this.industries.findBySlug(slug);
  }
}
