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
import {
  CurrentUser,
  type AuthenticatedAdmin,
} from '@/modules/auth/decorators/current-user.decorator';
import { QuotationService } from './quotation.service';
import {
  AddQuotationNoteDto,
  QuotationListQueryDto,
  UpdateQuotationStatusDto,
} from './dto/quotation-admin.dto';

@ApiTags('Admin — quotations')
@Controller('admin/quotations')
export class QuotationAdminController {
  constructor(private readonly quotations: QuotationService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated quotations, filterable by status, date range and search' })
  async list(@Query() query: QuotationListQueryDto) {
    return this.quotations.list(query);
  }

  /**
   * Declared before `:id` so the literal path is not captured by the dynamic
   * segment.
   */
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'CSV of the filtered set' })
  async export(@Query() query: QuotationListQueryDto): Promise<StreamableFile> {
    const quotations = await this.quotations.findAllForExport(query);

    /**
     * One row per LINE, not per quotation. The client's reason for exporting
     * is to work the items in a spreadsheet — pricing them up, checking stock —
     * and a single row per quotation with the items crammed into one cell is
     * useless for that. The quote number repeats so the rows regroup with a
     * pivot.
     */
    const rows = quotations.flatMap((quotation) =>
      quotation.items.map((item) => [
        quotation.quoteNumber,
        new Date(quotation.createdAt).toISOString().slice(0, 10),
        quotation.status,
        quotation.customer.company,
        quotation.customer.name,
        quotation.customer.designation ?? '',
        quotation.customer.email,
        quotation.customer.phone,
        quotation.address.line1,
        quotation.address.line2 ?? '',
        quotation.address.city,
        quotation.address.region,
        quotation.address.postalCode ?? '',
        quotation.address.country,
        item.sku,
        item.name,
        item.quantity,
        item.unit,
        item.note ?? '',
        quotation.message ?? '',
      ]),
    );

    const csv = toCsv(
      [
        'Quote number',
        'Received',
        'Status',
        'Company',
        'Contact',
        'Job title',
        'Email',
        'Phone',
        'Address line 1',
        'Address line 2',
        'City',
        'Region',
        'Postal code',
        'Country',
        'Part number',
        'Product',
        'Quantity',
        'Unit',
        'Line note',
        'Message',
      ],
      rows,
    );

    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      disposition: `attachment; filename="${timestampedFilename('quotations')}"`,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full quotation for the detail modal' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.quotations.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change status; appends to statusHistory' })
  async updateStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateQuotationStatusDto,
    @CurrentUser() admin: AuthenticatedAdmin,
  ) {
    return this.quotations.updateStatus(
      id,
      dto.status,
      { id: admin.id, name: admin.email },
      dto.note,
    );
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add an internal note' })
  async addNote(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddQuotationNoteDto,
    @CurrentUser() admin: AuthenticatedAdmin,
  ) {
    return this.quotations.addNote(id, dto.note, { id: admin.id, name: admin.email });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete — the record is kept and can be restored' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.quotations.remove(id);
  }
}
