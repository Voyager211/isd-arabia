import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { DatabaseModule } from './database/database.module';
import { CounterModule } from './database/counter.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { PasswordChangeGuard } from './modules/auth/guards/password-change.guard';
import { HealthModule } from './modules/health/health.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { RevalidationModule } from './modules/revalidation/revalidation.module';
import { CategoryModule } from './modules/categories/category.module';
import { BrandModule } from './modules/brands/brand.module';
import { IndustryModule } from './modules/industries/industry.module';
import { ProductModule } from './modules/products/product.module';
import { SearchModule } from './modules/search/search.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    AppConfigModule,

    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          transport: config.isProduction ? undefined : { target: 'pino-pretty' },
          // Credentials and tokens must never reach the log sink.
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'res.headers["set-cookie"]',
          ],
          autoLogging: {
            ignore: (req) => req.url?.endsWith('/health') === true,
          },
        },
      }),
    }),

    /**
     * The global limit from PROJECT_PLAN.md §12.3, and ONLY the global limit.
     *
     * Every named throttler declared here applies to every route. Declaring
     * the per-route buckets (login 5/15min, quotation 3/hour, catalogue
     * 5/hour) here would silently cap the whole API at 3 requests per hour,
     * because the strictest bucket wins on routes that never meant to opt in.
     *
     * Tighter per-route limits therefore override `default` at the handler:
     *     @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
     */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),

    DatabaseModule,
    CounterModule,
    RevalidationModule,
    UploadsModule,
    AuthModule,
    HealthModule,

    // Catalogue. CategoryModule / BrandModule / IndustryModule each register
    // the Product model directly rather than importing ProductModule, which is
    // what keeps the dependency graph acyclic.
    CategoryModule,
    BrandModule,
    IndustryModule,
    ProductModule,
    SearchModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },

    /**
     * Guard order matters and is the order they are listed in.
     *   1. Throttler  — cheapest rejection first, before any DB work.
     *   2. JwtAuthGuard — authenticate, unless the route is @Public().
     *   3. RolesGuard — authorise by role.
     *   4. PasswordChangeGuard — block everything until a forced rotation is done.
     *
     * Authentication is global and routes opt out, so a new admin endpoint is
     * protected unless someone actively unprotects it (acceptance #26).
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
  ],
})
export class AppModule {}
