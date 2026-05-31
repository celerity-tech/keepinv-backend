import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Supplier } from '@prisma/client';

import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../core/database/prisma.service';

const buildSupplier = (overrides: Partial<Supplier> = {}): Supplier => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Acme Supplies',
  contactName: null,
  email: null,
  phone: null,
  address: null,
  notes: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: {
    supplier: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSupplier', () => {
    it('persists the supplier payload', async () => {
      const body = { name: 'Acme Supplies', email: 'sales@acme.test' };
      const created = buildSupplier(body);
      prisma.supplier.create.mockResolvedValue(created);

      await expect(service.createSupplier(body)).resolves.toEqual(created);
      expect(prisma.supplier.create).toHaveBeenCalledWith({ data: body });
    });
  });

  describe('getAllSuppliers', () => {
    it('returns only active suppliers ordered by name', async () => {
      const suppliers = [buildSupplier()];
      prisma.supplier.findMany.mockResolvedValue(suppliers);

      await expect(service.getAllSuppliers()).resolves.toEqual(suppliers);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: { isArchived: false },
        orderBy: { name: 'asc' },
        include: { links: { where: { isArchived: false }, orderBy: { platform: 'asc' } } },
      });
    });
  });

  describe('getSupplier', () => {
    it('throws when the supplier does not exist or is archived', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      await expect(service.getSupplier(buildSupplier().id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSupplier', () => {
    it('updates an existing supplier', async () => {
      const target = buildSupplier();
      prisma.supplier.findFirst.mockResolvedValue(target);
      prisma.supplier.update.mockResolvedValue({ ...target, phone: '+1 555 0100' });

      await service.updateSupplier(target.id, { phone: '+1 555 0100' });

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { phone: '+1 555 0100' },
      });
    });

    it('throws when updating a supplier that does not exist', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSupplier(buildSupplier().id, { phone: '+1 555 0100' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.supplier.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveSupplier', () => {
    it('soft-deletes by setting isArchived', async () => {
      const target = buildSupplier();
      prisma.supplier.findFirst.mockResolvedValue(target);
      prisma.supplier.update.mockResolvedValue({ ...target, isArchived: true });

      await service.archiveSupplier(target.id);

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { isArchived: true },
      });
    });
  });
});
