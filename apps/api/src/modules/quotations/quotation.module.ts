import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/modules/products/product.schema';
import { Quotation, QuotationSchema } from './quotation.schema';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { QuotationAdminController } from './quotation.admin.controller';

/**
 * Registers the Product model directly rather than importing ProductModule:
 * the only thing quotations need from products is a read for the submission
 * snapshot, and importing the whole module for that would pull the catalogue's
 * dependency graph in behind it.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quotation.name, schema: QuotationSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [QuotationController, QuotationAdminController],
  providers: [QuotationService],
  exports: [QuotationService],
})
export class QuotationModule {}
