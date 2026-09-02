import { Global, Module } from '@nestjs/common';

import { CloudinaryService } from './cloudinary.service';
import { UploadsController } from './uploads.controller';

/**
 * Global: categories, brands, industries, products and the catalogue module
 * all need the Cloudinary client, and re-importing it in six places to get one
 * stateless service is noise.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadsModule {}
