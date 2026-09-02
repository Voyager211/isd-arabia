import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

/** Global: quotations and, later, any other notification path need it. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
