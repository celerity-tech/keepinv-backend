import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockMovement, StockMovementEffect } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateStockMovementDTO } from './dto/create-stock-movement.dto';
import { FilterStockMovementsDTO } from './dto/filter-stock-movements.dto';
import { StockMovementsService } from './stock-movements.service';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const MOVEMENT_TYPE_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const buildMovement = (overrides: Partial<StockMovement> = {}): StockMovement => ({
  id: '33333333-3333-3333-3333-333333333333',
  legacyType: null,
  stockMovementTypeId: MOVEMENT_TYPE_ID,
  quantityChange: 5,
  quantityAfter: 5,
  note: null,
  organizationId: 'org-1',
  productId: PRODUCT_ID,
  productUnitId: null,
  locationId: null,
  supplierId: null,
  userId: USER_ID,
  saleId: null,
  saleItemId: null,
  createdAt: new Date(),
  ...overrides,
});

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let tx: {
    product: { update: jest.Mock };
    stockMovement: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };
  let prisma: {
    product: { findFirst: jest.Mock; update: jest.Mock };
    supplier: { findFirst: jest.Mock };
    location: { findFirst: jest.Mock };
    stockMovementType: { findFirst: jest.Mock };
    stockMovement: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    setTenantContext: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const product = {
      findFirst: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
      update: jest.fn(),
    };
    const stockMovement = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    };

    tx = { product, stockMovement };
    prisma = {
      product,
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      stockMovementType: {
        findFirst: jest.fn().mockResolvedValue({
          id: MOVEMENT_TYPE_ID,
          effect: StockMovementEffect.INCREASE,
        }),
      },
      stockMovement,
      setTenantContext: jest.fn(),
      $transaction: jest.fn().mockImplementation((arg) =>
        typeof arg === 'function' ? arg(tx) : Promise.all(arg),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockMovementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
  });

  describe('recordStockMovement', () => {
    const record = (body: Partial<CreateStockMovementDTO>) =>
      service.recordStockMovement(USER_ID, {
        productId: PRODUCT_ID,
        stockMovementTypeId: MOVEMENT_TYPE_ID,
        quantity: 5,
        ...body,
      } as CreateStockMovementDTO);

    it('increments stock for an increasing type and snapshots quantityAfter', async () => {
      tx.product.update.mockResolvedValue({ quantityOnHand: 5 });
      tx.stockMovement.create.mockResolvedValue(buildMovement());

      await record({ quantity: 5 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: 5 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stockMovementTypeId: MOVEMENT_TYPE_ID,
          quantityChange: 5,
          quantityAfter: 5,
          userId: USER_ID,
        }),
      });
    });

    it('decrements stock for a decreasing type', async () => {
      prisma.stockMovementType.findFirst.mockResolvedValue({
        id: MOVEMENT_TYPE_ID,
        effect: StockMovementEffect.DECREASE,
      });
      tx.product.update.mockResolvedValue({ quantityOnHand: 3 });
      tx.stockMovement.create.mockResolvedValue(buildMovement({ quantityChange: -2 }));

      await record({ quantity: 2 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: -2 } },
      });
    });

    it('applies a signed delta for an adjustment type', async () => {
      prisma.stockMovementType.findFirst.mockResolvedValue({
        id: MOVEMENT_TYPE_ID,
        effect: StockMovementEffect.ADJUSTMENT,
      });
      tx.product.update.mockResolvedValue({ quantityOnHand: 1 });
      tx.stockMovement.create.mockResolvedValue(buildMovement({ quantityChange: -4 }));

      await record({ quantity: -4 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: -4 } },
      });
    });

    it('rejects a movement that would drive stock below zero', async () => {
      prisma.stockMovementType.findFirst.mockResolvedValue({
        id: MOVEMENT_TYPE_ID,
        effect: StockMovementEffect.DECREASE,
      });
      tx.product.update.mockResolvedValue({ quantityOnHand: -1 });

      await expect(record({ quantity: 9 })).rejects.toThrow(BadRequestException);
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects zero for an adjustment type', async () => {
      prisma.stockMovementType.findFirst.mockResolvedValue({
        id: MOVEMENT_TYPE_ID,
        effect: StockMovementEffect.ADJUSTMENT,
      });

      await expect(record({ quantity: 0 })).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an archived or missing movement type', async () => {
      prisma.stockMovementType.findFirst.mockResolvedValue(null);

      await expect(record({})).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws when the product does not exist or is archived', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      // Refs are validated inside the transaction now (so it rolls back), so the tx is entered.
      await expect(record({})).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getAllStockMovements', () => {
    const filter = (
      overrides: Partial<FilterStockMovementsDTO> = {},
    ): FilterStockMovementsDTO =>
      ({ page: 1, limit: 10, ...overrides }) as FilterStockMovementsDTO;

    it('returns paginated data with computed meta', async () => {
      const rows = [buildMovement()];
      prisma.stockMovement.findMany.mockResolvedValue(rows);
      prisma.stockMovement.count.mockResolvedValue(12);

      const result = await service.getAllStockMovements(filter({ page: 2, limit: 10 }));

      expect(result.data).toBe(rows);
      expect(result.meta).toEqual({ total: 12, page: 2, limit: 10, lastPage: 2 });
    });

    it('builds a movement-type and date-range filter', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.getAllStockMovements(
        filter({
          productId: PRODUCT_ID,
          stockMovementTypeId: MOVEMENT_TYPE_ID,
          dateFrom: '2026-01-01',
          dateTo: '2026-02-01',
        }),
      );

      const where = prisma.stockMovement.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        productId: PRODUCT_ID,
        stockMovementTypeId: MOVEMENT_TYPE_ID,
      });
      expect(where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(where.createdAt.lte).toEqual(new Date('2026-02-01'));
    });
  });

  it('throws when a stock movement does not exist', async () => {
    prisma.stockMovement.findUnique.mockResolvedValue(null);

    await expect(service.getStockMovement(buildMovement().id)).rejects.toThrow(
      NotFoundException,
    );
  });
});
