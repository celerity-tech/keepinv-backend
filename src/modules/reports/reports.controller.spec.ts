import { Test, TestingModule } from '@nestjs/testing';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  const reportsService = { getInventoryDashboardReport: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to the service', async () => {
    const report = { totals: { productCount: 0 } };
    reportsService.getInventoryDashboardReport.mockResolvedValue(report);

    await expect(controller.getInventoryDashboardReport()).resolves.toBe(report);
    expect(reportsService.getInventoryDashboardReport).toHaveBeenCalledTimes(1);
  });
});
