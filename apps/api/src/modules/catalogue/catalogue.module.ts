import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CatalogueFile, CatalogueFileSchema } from './catalogue-file.schema';
import { CatalogueLead, CatalogueLeadSchema } from './catalogue-lead.schema';
import { CatalogueService } from './catalogue.service';
import { CatalogueController } from './catalogue.controller';
import { CatalogueAdminController } from './catalogue.admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CatalogueFile.name, schema: CatalogueFileSchema },
      { name: CatalogueLead.name, schema: CatalogueLeadSchema },
    ]),
  ],
  controllers: [CatalogueController, CatalogueAdminController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
