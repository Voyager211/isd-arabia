import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/modules/products/product.schema';
import { Industry, IndustrySchema } from './industry.schema';
import { IndustryService } from './industry.service';
import { IndustryController } from './industry.controller';
import { IndustryAdminController } from './industry.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Industry.name, schema: IndustrySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [IndustryController, IndustryAdminController],
  providers: [IndustryService],
  exports: [IndustryService, MongooseModule],
})
export class IndustryModule {}
