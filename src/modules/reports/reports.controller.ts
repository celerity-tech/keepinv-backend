import { Controller, Get } from '@nestjs/common';

import { ReportsService } from './reports.service';
import { InventoryDashboardReport } from './types/reports.types';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('inventory-dashboard')
  async getInventoryDashboardReport(): Promise<InventoryDashboardReport> {
    return this.reportsService.getInventoryDashboardReport();
  }
}
