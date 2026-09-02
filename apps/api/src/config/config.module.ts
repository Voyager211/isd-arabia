import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { validateEnv } from './env.schema';
import { AppConfigService } from './config.service';

/**
 * Global config. `validate` runs the Zod schema at boot, so an invalid
 * environment fails module initialisation rather than the first request.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService, ConfigService],
  exports: [AppConfigService, NestConfigModule],
})
export class AppConfigModule {}
