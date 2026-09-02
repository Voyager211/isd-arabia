import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppConfigModule } from '@/config/config.module';
import { AppConfigService } from '@/config/config.service';

const logger = new Logger('Database');

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.get('MONGODB_URI'),
        dbName: config.get('MONGODB_DB_NAME'),

        // Atlas M0 caps the cluster at 500 connections and the default pool
        // size is far too generous for a free tier shared with a seed script
        // and a staging deploy (PROJECT_PLAN.md §14.1).
        maxPoolSize: 10,
        minPoolSize: 1,

        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        retryWrites: true,

        // Index creation is a deploy-time operation, not a boot-time one.
        // Building indexes automatically on a shared-CPU tier can stall the
        // first requests after a cold start.
        autoIndex: !config.isProduction,

        onConnectionCreate: () => {
          logger.log(`Connected to MongoDB database '${config.get('MONGODB_DB_NAME')}'`);
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
