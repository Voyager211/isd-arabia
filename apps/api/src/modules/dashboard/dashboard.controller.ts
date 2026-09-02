import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';

@ApiTags('Admin — dashboard')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Counts and recent activity for the admin dashboard' })
  async stats() {
    return this.dashboard.getStats();
  }
}
