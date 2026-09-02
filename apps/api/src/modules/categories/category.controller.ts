import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/modules/auth/decorators/public.decorator';
import { CategoryService } from './category.service';

/** Public catalogue reads (PROJECT_PLAN.md §8.1). */
@ApiTags('Catalogue — categories')
@Public()
@Controller('categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Full category tree, or a flat list with ?flat=true' })
  async list(@Query('flat') flat?: string) {
    return flat === 'true' ? this.categories.getFlat() : this.categories.getTree();
  }

  /**
   * Listed before `:slug` on purpose — Nest matches routes in declaration
   * order, so a dynamic segment declared first would swallow `/menu`.
   */
  @Get('menu')
  @ApiOperation({ summary: 'Mega-menu tree, trimmed to what the panel renders' })
  async menu() {
    return this.categories.getMenu();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Single category with its breadcrumb trail' })
  async findOne(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }
}
