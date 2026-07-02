import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, ProductUnitStatus } from '@prisma/client';

import { ReportsService } from './reports.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  // A minimal transaction client whose per-model methods we stub per test.
  const tx = {
    product: { findMany: jest.fn(), groupBy: jest.fn() },
    productUnit: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    category: { findMany: jest.fn() },
    location: { findMany: jest.fn() },
  };

  const prisma = {
    setTenantContext: jest.fn().mockResolvedValue(undefined),
    // Run the callback against the stub tx client, ignoring isolation options.
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    tx.product.findMany.mockResolvedValue([
      { costPrice: new Prisma.Decimal('10.00'), quantityOnHand: 3, reorderPoint: 5 }, // low stock
      { costPrice: new Prisma.Decimal('2.50'), quantityOnHand: 10, reorderPoint: null },
    ]);
    tx.productUnit.groupBy.mockImplementation(({ by }: { by: string[] }) => {
      if (by.includes('status')) {
        return Promise.resolve([
          { status: ProductUnitStatus.IN_STOCK, _count: { _all: 4 } },
          { status: ProductUnitStatus.SOLD, _count: { _all: 7 } },
          { status: ProductUnitStatus.MISSING, _count: { _all: 1 } },
        ]);
      }
      // by location (serialized units)
      return Promise.resolve([{ locationId: 'loc-1', _count: { _all: 4 } }]);
    });
    tx.product.groupBy.mockImplementation(({ by }: { by: string[] }) => {
      if (by.includes('categoryId')) {
        return Promise.resolve([
          { categoryId: 'cat-1', _sum: { quantityOnHand: 13 }, _count: { _all: 2 } },
        ]);
      }
      // by location (non-serialized products)
      return Promise.resolve([{ locationId: 'loc-1', _sum: { quantityOnHand: 13 } }]);
    });
    tx.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Brakes' }]);
    tx.location.findMany.mockResolvedValue([{ id: 'loc-1', name: 'Front Shelf' }]);
    tx.productUnit.count.mockResolvedValue(0);
    tx.productUnit.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes stock KPIs and excludes retired units from tracked count', async () => {
    const report = await service.getInventoryDashboardReport();

    expect(report.totals.productCount).toBe(2);
    expect(report.totals.stockValue).toBe(55); // 10*3 + 2.5*10
    expect(report.totals.lowStockCount).toBe(1);
    // 4 IN_STOCK + 1 MISSING counted; 7 SOLD excluded.
    expect(report.totals.trackedUnitCount).toBe(5);
  });

  it('merges non-serialized product qty and serialized unit counts per location', async () => {
    const report = await service.getInventoryDashboardReport();

    expect(report.byLocation).toEqual([
      { locationId: 'loc-1', locationName: 'Front Shelf', quantity: 17 }, // 13 products + 4 units
    ]);
    expect(report.byCategory).toEqual([
      { categoryId: 'cat-1', categoryName: 'Brakes', quantity: 13, productCount: 2 },
    ]);
  });
});
