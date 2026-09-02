import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/modules/products/product.schema';
import { Brand, BrandSchema } from './brand.schema';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { BrandAdminController } from './brand.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Brand.name, schema: BrandSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [BrandController, BrandAdminController],
  providers: [BrandService],
  exports: [BrandService, MongooseModule],
})
export class BrandModule {}
