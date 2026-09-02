import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CategoryModule } from '@/modules/categories/category.module';
import { BrandModule } from '@/modules/brands/brand.module';
import { IndustryModule } from '@/modules/industries/industry.module';
import { Category, CategorySchema } from '@/modules/categories/category.schema';
import { Product, ProductSchema } from './product.schema';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductAdminController } from './product.admin.controller';

/**
 * Depends on the three taxonomy modules to turn filter slugs into ids and to
 * validate a product's placement. The dependency runs one way only — those
 * modules register the Product model directly rather than importing this one,
 * which is what keeps the graph acyclic.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    CategoryModule,
    BrandModule,
    IndustryModule,
  ],
  controllers: [ProductController, ProductAdminController],
  providers: [ProductService],
  exports: [ProductService, MongooseModule],
})
export class ProductModule {}
