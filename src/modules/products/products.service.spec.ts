import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';

import { ProductsService } from './products.service';
import { PrismaService } from '../../core/database/prisma.service';
import { FilterProductsDTO } from './dto/filter-products.dto';

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Cola 1L',
  description: null,
  sku: 'SKU-001',
  barcode: null,
  brand: null,
  costPrice: 0 as unknown as Product['costPrice'],
  sellingPrice: 0 as unknown as Product['sellingPrice'],
  quantityOnHand: 0,
  reorderPoint: null,
  isSerialized: false,
  isArchived: false,
  organizationId: 'org-1',
  categoryId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  supplierId: null,
  locationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const baseCreate = {
  name: 'Cola 1L',
  sku: 'SKU-001',
  categoryId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      fields: { reorderPoint: unknown };
    };
    category: { findFirst: jest.Mock };
    supplier: { findFirst: jest.Mock };
    location: { findFirst: jest.Mock };
    setTenantContext: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        fields: { reorderPoint: 'REORDER_REF' },
      },
      category: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      setTenantContext: jest.fn(),
      $transaction: jest.fn(),
    };
    // Interactive transactions receive the same mock as the tx client; array form resolves all.
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof prisma) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('creates a product when the SKU is free and relations are valid', async () => {
      const created = buildProduct();
      prisma.category.findFirst.mockResolvedValue({ id: baseCreate.categoryId });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(created);

      await expect(service.createProduct(baseCreate)).resolves.toEqual(created);
      expect(prisma.product.create).toHaveBeenCalledWith({ data: baseCreate });
    });

    it('rejects a missing category before touching the SKU', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.createProduct(baseCreate)).rejects.toThrow(NotFoundException);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a SKU already used by an active product', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: baseCreate.categoryId });
      prisma.product.findFirst.mockResolvedValue(buildProduct());

      await expect(service.createProduct(baseCreate)).rejects.toThrow(ConflictException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('reactivates an archived product with the same SKU', async () => {
      const archived = buildProduct({ isArchived: true });
      prisma.category.findFirst.mockResolvedValue({ id: baseCreate.categoryId });
      prisma.product.findFirst.mockResolvedValue(archived);
      prisma.product.update.mockResolvedValue({ ...archived, isArchived: false });

      await service.createProduct(baseCreate);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: archived.id },
        data: { ...baseCreate, isArchived: false },
      });
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('rejects a barcode already owned by a different product', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: baseCreate.categoryId });
      prisma.product.findFirst
        .mockResolvedValueOnce(null) // SKU lookup
        .mockResolvedValueOnce(buildProduct({ id: 'other', barcode: '12345' })); // barcode lookup

      await expect(service.createProduct({ ...baseCreate, barcode: '12345' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.product.create).not.toHaveBeenCalled();
    });
  });

  describe('getAllProducts', () => {
    const filter = (overrides: Partial<FilterProductsDTO> = {}): FilterProductsDTO =>
      ({ page: 1, limit: 10, ...overrides } as FilterProductsDTO);

    it('returns paginated data with computed meta', async () => {
      const rows = [buildProduct()];
      prisma.product.findMany.mockResolvedValue(rows);
      prisma.product.count.mockResolvedValue(23);

      const result = await service.getAllProducts(filter({ page: 2, limit: 10 }));

      expect(result.data).toBe(rows);
      expect(result.meta).toEqual({ total: 23, page: 2, limit: 10, lastPage: 3 });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, orderBy: { name: 'asc' } }),
      );
    });

    it('builds a low-stock + search + category where clause', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.getAllProducts(
        filter({ search: 'cola', categoryId: 'cat-1', lowStock: true }),
      );

      const where = prisma.product.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        isArchived: false,
        categoryId: 'cat-1',
        reorderPoint: { not: null },
        quantityOnHand: { lte: 'REORDER_REF' },
      });
      expect(where.OR).toEqual([
        { name: { contains: 'cola', mode: 'insensitive' } },
        { sku: { contains: 'cola', mode: 'insensitive' } },
        { barcode: { contains: 'cola', mode: 'insensitive' } },
      ]);
    });
  });

  describe('getProduct', () => {
    it('throws when the product does not exist or is archived', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.getProduct(buildProduct().id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProduct', () => {
    it('rejects a SKU change that collides with a different product', async () => {
      const target = buildProduct();
      prisma.product.findFirst.mockResolvedValue(target); // getProduct
      prisma.product.findFirst.mockResolvedValue(buildProduct({ id: 'other', sku: 'SKU-002' }));

      await expect(service.updateProduct(target.id, { sku: 'SKU-002' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveProduct', () => {
    it('soft-deletes by setting isArchived', async () => {
      const target = buildProduct();
      prisma.product.findFirst.mockResolvedValue(target);
      prisma.product.update.mockResolvedValue({ ...target, isArchived: true });

      await service.archiveProduct(target.id);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { isArchived: true },
      });
    });
  });
});
