import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { extractRequestMeta } from '@/common/utils/request-meta.util';
import { TurnstileService } from '@/modules/security/turnstile.service';
import { CatalogueService } from './catalogue.service';
import { CatalogueDownloadDto } from './dto/catalogue.dto';

@ApiTags('Catalogue download')
@Public()
@Controller('catalogue')
export class CatalogueController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Get('active')
  @ApiOperation({ summary: 'Active catalogue metadata — no file URL when gated' })
  async active() {
    return this.catalogue.getActive();
  }

  /**
   * Captures a lead and returns a signed, expiring URL (PROJECT_PLAN.md §9.7).
   *
   * 5 per hour per IP. Higher than the quotation limit because a shared office
   * NAT can legitimately produce several downloads in a morning, and the cost
   * of a duplicate lead is far lower than the cost of a blocked one.
   */
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the lead form and receive a time-limited download URL' })
  async download(@Body() dto: CatalogueDownloadDto, @Req() request: Request) {
    this.turnstile.assertHoneypotEmpty(dto.website);
    await this.turnstile.verify(dto.turnstileToken, request.ip);

    return this.catalogue.requestDownload(dto, extractRequestMeta(request));
  }
}
