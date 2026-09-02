import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/modules/products/product.schema';
import { Category, CategorySchema } from './category.schema';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryAdminController } from './category.admin.controller';

/**
 * The Product model is registered here as well because deleting a category has
 * to count the products underneath it, and a category move has to repair their
 * `categoryPath`. Importing ProductModule instead would be circular — products
 * need CategoryService to resolve their own placement.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CategoryController, CategoryAdminController],
  providers: [CategoryService],
  exports: [CategoryService, MongooseModule],
})
export class CategoryModule {}
