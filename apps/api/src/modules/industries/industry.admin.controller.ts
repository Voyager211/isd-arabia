import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { IndustryService } from './industry.service';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';

@ApiTags('Admin — industries')
@Controller('admin/industries')
export class IndustryAdminController {
  constructor(private readonly industries: IndustryService) {}

  @Get()
  async list() {
    return this.industries.findAll({ includeInactive: true });
  }

  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.industries.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateIndustryDto) {
    return this.industries.create(dto);
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateIndustryDto) {
    return this.industries.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — blocked while products reference it' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.industries.remove(id);
  }
}
