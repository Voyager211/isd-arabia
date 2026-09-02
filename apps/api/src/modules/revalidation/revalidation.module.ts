import { Global, Module } from '@nestjs/common';

import { RevalidationService } from './revalidation.service';

/** Global — every catalogue write path emits revalidation. */
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
