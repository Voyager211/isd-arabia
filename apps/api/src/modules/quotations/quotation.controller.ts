import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { extractRequestMeta } from '@/common/utils/request-meta.util';
import { TurnstileService } from '@/modules/security/turnstile.service';
import { QuotationService } from './quotation.service';
import { SubmitQuotationDto } from './dto/submit-quotation.dto';

@ApiTags('Quotations')
@Controller('quotations')
export class QuotationController {
  constructor(
    private readonly quotations: QuotationService,
    private readonly turnstile: TurnstileService,
  ) {}

  /**
   * Submits a quotation request (PROJECT_PLAN.md §8.1).
   *
   * Three spam layers, cheapest first: a per-IP rate limit of 3 an hour, a
   * honeypot field, then the Turnstile round trip. Ordering matters — the
   * limiter and the honeypot cost nothing, so an obvious bot never reaches the
   * external call.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a quotation request' })
  async submit(@Body() dto: SubmitQuotationDto, @Req() request: Request) {
    this.turnstile.assertHoneypotEmpty(dto.website);
    await this.turnstile.verify(dto.turnstileToken, request.ip);

    return this.quotations.submit(dto, extractRequestMeta(request));
  }
}
