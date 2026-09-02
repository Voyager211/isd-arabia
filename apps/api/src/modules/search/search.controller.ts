import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { ProductService } from '@/modules/products/product.service';

@ApiTags('Catalogue — search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly products: ProductService) {}

  /**
   * Typeahead (PROJECT_PLAN.md §8.1, §9.6).
   *
   * Capped at 8 results. The full result set lives behind `GET /products?q=`,
   * which the storefront's /search page uses — this endpoint only feeds the
   * dropdown and is called on every debounced keystroke, so it stays small.
   */
  @Get('suggest')
  @ApiOperation({ summary: 'Typeahead suggestions, max 8' })
  async suggest(@Query('q') q?: string) {
    return this.products.suggest(q ?? '');
  }
}
