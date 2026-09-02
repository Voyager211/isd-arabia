import { Global, Module } from '@nestjs/common';

import { TurnstileService } from './turnstile.service';

/** Global: both public write endpoints verify a Turnstile token. */
@Global()
@Module({
  providers: [TurnstileService],
  exports: [TurnstileService],
})
export class SecurityModule {}
