import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { timestampedFilename, toCsv } from '@/common/utils/csv.util';
import { CatalogueService } from './catalogue.service';
import {
  CatalogueLeadQueryDto,
  CreateCatalogueFileDto,
  UpdateCatalogueFileDto,
} from './dto/catalogue.dto';

@ApiTags('Admin — catalogue')
@Controller('admin/catalogue')
export class CatalogueAdminController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'All catalogue files, active first' })
  async list() {
    return this.catalogue.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Register an uploaded catalogue PDF' })
  async create(@Body() dto: CreateCatalogueFileDto) {
    return this.catalogue.create(dto);
  }

  /**
   * The two literal `leads` paths are declared before `:id`, so the dynamic
   * segment does not capture them.
   */
  @Get('leads/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'CSV of the filtered leads' })
  async exportLeads(@Query() query: CatalogueLeadQueryDto): Promise<StreamableFile> {
    const leads = await this.catalogue.findAllLeadsForExport(query);

    const csv = toCsv(
      ['Date', 'Name', 'Company', 'Email', 'Phone', 'Catalogue'],
      leads.map((lead) => [
        new Date(lead.createdAt).toISOString().slice(0, 10),
        lead.name,
        lead.company,
        lead.email,
        lead.phone,
        lead.catalogueTitle ?? '',
      ]),
    );

    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      disposition: `attachment; filename="${timestampedFilename('catalogue-leads')}"`,
    });
  }

  @Get('leads')
  @ApiOperation({ summary: 'Paginated download leads' })
  async leads(@Query() query: CatalogueLeadQueryDto) {
    return this.catalogue.findLeads(query);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Make this file active and deactivate the rest' })
  async activate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalogue.activate(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update metadata; the PDF itself is replaced by a new record' })
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCatalogueFileDto) {
    return this.catalogue.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — the Cloudinary asset is kept' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalogue.remove(id);
  }
}
