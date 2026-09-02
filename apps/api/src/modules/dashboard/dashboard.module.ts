import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Category, CategorySchema } from '@/modules/categories/category.schema';
import { Product, ProductSchema } from '@/modules/products/product.schema';
import { QuotationModule } from '@/modules/quotations/quotation.module';
import { CatalogueModule } from '@/modules/catalogue/catalogue.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    QuotationModule,
    CatalogueModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
