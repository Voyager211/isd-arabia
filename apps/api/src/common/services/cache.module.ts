import { Global, Module } from '@nestjs/common';

import { MemoryCacheService } from './memory-cache.service';

/** Global — the taxonomy services are its only consumers today. */
@Global()
@Module({
  providers: [MemoryCacheService],
  exports: [MemoryCacheService],
})
export class CacheModule {}
