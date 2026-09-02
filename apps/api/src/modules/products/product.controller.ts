import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { ProductService } from './product.service';
import { ProductListQueryDto } from './dto/product-list-query.dto';

@ApiTags('Catalogue — products')
@Public()
@Controller('products')
export class ProductController {
  constructor(private readonly products: ProductService) {}

  /**
   * Returns `{ data, meta }` so the interceptor can attach pagination and the
   * facet counts the sidebar renders without a second round trip.
   */
  @Get()
  @ApiOperation({ summary: 'Product listing with facet counts' })
  async list(@Query() query: ProductListQueryDto) {
    return this.products.list(query);
  }

  /** Declared before `:slug` — a dynamic segment first would swallow it. */
  @Get('slugs')
  @ApiOperation({ summary: 'All active slugs, for generateStaticParams and the sitemap' })
  async slugs() {
    return this.products.findAllSlugs();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Single product with category, brand and industries resolved' })
  async findOne(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Eight products from the same category' })
  async related(@Param('slug') slug: string) {
    return this.products.findRelated(slug);
  }
}
