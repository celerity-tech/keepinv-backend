import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockMovement, StockMovementType } from '@prisma/client';

import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateStockMovementDTO } from './dto/create-stock-movement.dto';
import { FilterStockMovementsDTO } from './dto/filter-stock-movements.dto';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const buildMovement = (overrides: Partial<StockMovement> = {}): StockMovement => ({
  id: '22222222-2222-2222-2222-222222222222',
  type: StockMovementType.PURCHASE,
  quantityChange: 5,
  quantityAfter: 5,
  note: null,
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
    stockMovement: { create: jest.Mock };
  };
  let prisma: {
    product: { findFirst: jest.Mock };
    supplier: { findFirst: jest.Mock };
    location: { findFirst: jest.Mock };
    stockMovement: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      product: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
    };

    prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: PRODUCT_ID }) },
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      stockMovement: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      // Interactive form for writes; array form for the paginated read.
      $transaction: jest.fn().mockImplementation((arg) =>
        typeof arg === 'function' ? arg(tx) : Promise.resolve(arg),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockMovementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordStockMovement', () => {
    const record = (body: Partial<CreateStockMovementDTO>) =>
      service.recordStockMovement(USER_ID, {
        productId: PRODUCT_ID,
        type: StockMovementType.PURCHASE,
        quantity: 5,
        ...body,
      } as CreateStockMovementDTO);

    it('increments stock for a PURCHASE and snapshots quantityAfter', async () => {
      tx.product.update.mockResolvedValue({ quantityOnHand: 5 });
      tx.stockMovement.create.mockResolvedValue(buildMovement());

      await record({ type: StockMovementType.PURCHASE, quantity: 5 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: 5 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantityChange: 5, quantityAfter: 5, userId: USER_ID }),
        }),
      );
    });

    it('decrements stock for a SALE', async () => {
      tx.product.update.mockResolvedValue({ quantityOnHand: 3 });
      tx.stockMovement.create.mockResolvedValue(buildMovement({ quantityChange: -2 }));

      await record({ type: StockMovementType.SALE, quantity: 2 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: -2 } },
      });
    });

    it('applies a signed delta for ADJUSTMENT', async () => {
      tx.product.update.mockResolvedValue({ quantityOnHand: 1 });
      tx.stockMovement.create.mockResolvedValue(buildMovement({ quantityChange: -4 }));

      await record({ type: StockMovementType.ADJUSTMENT, quantity: -4 });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { quantityOnHand: { increment: -4 } },
      });
    });

    it('rejects and rolls back a movement that would go negative', async () => {
      tx.product.update.mockResolvedValue({ quantityOnHand: -1 });

      await expect(record({ type: StockMovementType.SALE, quantity: 9 })).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects TRANSFER movements', async () => {
      await expect(record({ type: StockMovementType.TRANSFER, quantity: 1 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a non-positive quantity for non-ADJUSTMENT types', async () => {
      await expect(record({ type: StockMovementType.PURCHASE, quantity: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a zero ADJUSTMENT', async () => {
      await expect(record({ type: StockMovementType.ADJUSTMENT, quantity: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the product does not exist or is archived', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(record({ type: StockMovementType.PURCHASE, quantity: 5 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws when a provided supplier does not exist', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        record({ type: StockMovementType.PURCHASE, quantity: 5, supplierId: 'sup-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllStockMovements', () => {
    const filter = (overrides: Partial<FilterStockMovementsDTO> = {}): FilterStockMovementsDTO =>
      ({ page: 1, limit: 10, ...overrides } as FilterStockMovementsDTO);

    it('returns paginated data with computed meta', async () => {
      const rows = [buildMovement()];
      prisma.$transaction.mockResolvedValueOnce([rows, 12]);

      const result = await service.getAllStockMovements(filter({ page: 2, limit: 10 }));

      expect(result.data).toBe(rows);
      expect(result.meta).toEqual({ total: 12, page: 2, limit: 10, lastPage: 2 });
      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('builds a productId + type + date-range where clause', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.getAllStockMovements(
        filter({
          productId: PRODUCT_ID,
          type: StockMovementType.SALE,
          dateFrom: '2026-01-01',
          dateTo: '2026-02-01',
        }),
      );

      const where = prisma.stockMovement.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ productId: PRODUCT_ID, type: StockMovementType.SALE });
      expect(where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(where.createdAt.lte).toEqual(new Date('2026-02-01'));
    });
  });

  describe('getStockMovement', () => {
    it('throws when the movement does not exist', async () => {
      prisma.stockMovement.findUnique.mockResolvedValue(null);
      await expect(service.getStockMovement(buildMovement().id)).rejects.toThrow(NotFoundException);
    });
  });
});
