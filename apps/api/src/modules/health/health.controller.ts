import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/decorators/public.decorator';

/**
 * Liveness probe (PROJECT_PLAN.md §14.2).
 *
 * Built in Phase 1 rather than Phase 7 so UptimeRobot can be pointed at it
 * before staging goes up — Render's free tier sleeps after 15 minutes of
 * inactivity with a 30–50s cold start, and the pinger is what keeps it warm.
 *
 * Must answer in under 200ms (acceptance criterion #34), so it reports the
 * cached Mongoose connection state rather than issuing a round trip.
 */
@ApiTags('System')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness probe for UptimeRobot' })
  check() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      database: this.databaseState(),
      timestamp: new Date().toISOString(),
    };
  }

  private databaseState(): 'connected' | 'connecting' | 'disconnected' {
    switch (this.connection.readyState) {
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      default:
        return 'disconnected';
    }
  }
}
