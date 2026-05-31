import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupplierLink, SupplierPlatform } from '@prisma/client';

import { SupplierLinksService } from './supplier-links.service';
import { SuppliersService } from '../suppliers.service';
import { PrismaService } from '../../../core/database/prisma.service';

const SUPPLIER_ID = '11111111-1111-1111-1111-111111111111';

const buildLink = (overrides: Partial<SupplierLink> = {}): SupplierLink => ({
  id: '22222222-2222-2222-2222-222222222222',
  supplierId: SUPPLIER_ID,
  platform: SupplierPlatform.SHOPEE,
  url: 'https://shopee.ph/acme',
  label: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SupplierLinksService', () => {
  let service: SupplierLinksService;
  let prisma: {
    supplierLink: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let suppliers: { getSupplier: jest.Mock };

  beforeEach(async () => {
    prisma = {
      supplierLink: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    suppliers = { getSupplier: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierLinksService,
        { provide: PrismaService, useValue: prisma },
        { provide: SuppliersService, useValue: suppliers },
      ],
    }).compile();

    service = module.get<SupplierLinksService>(SupplierLinksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSupplierLink', () => {
    it('creates a link when the platform is free', async () => {
      const created = buildLink();
      prisma.supplierLink.findFirst.mockResolvedValue(null);
      prisma.supplierLink.create.mockResolvedValue(created);

      const body = { platform: SupplierPlatform.SHOPEE, url: 'https://shopee.ph/acme' };
      await expect(service.createSupplierLink(SUPPLIER_ID, body)).resolves.toEqual(created);
      expect(prisma.supplierLink.create).toHaveBeenCalledWith({
        data: { ...body, supplierId: SUPPLIER_ID },
      });
    });

    it('rejects a platform already linked to an active link', async () => {
      prisma.supplierLink.findFirst.mockResolvedValue(buildLink());

      await expect(
        service.createSupplierLink(SUPPLIER_ID, {
          platform: SupplierPlatform.SHOPEE,
          url: 'https://shopee.ph/other',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.supplierLink.create).not.toHaveBeenCalled();
    });

    it('reactivates an archived link for the same platform instead of failing', async () => {
      const archived = buildLink({ isArchived: true });
      prisma.supplierLink.findFirst.mockResolvedValue(archived);
      prisma.supplierLink.update.mockResolvedValue({ ...archived, isArchived: false });

      await service.createSupplierLink(SUPPLIER_ID, {
        platform: SupplierPlatform.SHOPEE,
        url: 'https://shopee.ph/new',
        label: 'New Store',
      });

      expect(prisma.supplierLink.update).toHaveBeenCalledWith({
        where: { id: archived.id },
        data: { url: 'https://shopee.ph/new', label: 'New Store', isArchived: false },
      });
      expect(prisma.supplierLink.create).not.toHaveBeenCalled();
    });

    it('throws when the parent supplier does not exist', async () => {
      suppliers.getSupplier.mockRejectedValue(new NotFoundException());

      await expect(
        service.createSupplierLink(SUPPLIER_ID, {
          platform: SupplierPlatform.SHOPEE,
          url: 'https://shopee.ph/acme',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.supplierLink.create).not.toHaveBeenCalled();
    });
  });

  describe('getSupplierLink', () => {
    it('throws when the link is missing or archived', async () => {
      prisma.supplierLink.findFirst.mockResolvedValue(null);
      await expect(service.getSupplierLink(SUPPLIER_ID, buildLink().id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSupplierLink', () => {
    it('rejects switching to a platform already taken by another link', async () => {
      const target = buildLink({ platform: SupplierPlatform.LAZADA });
      const other = buildLink({ id: '33333333-3333-3333-3333-333333333333' });
      prisma.supplierLink.findFirst
        .mockResolvedValueOnce(target) // getSupplierLink
        .mockResolvedValueOnce(other); // findLinkByPlatform

      await expect(
        service.updateSupplierLink(SUPPLIER_ID, target.id, { platform: SupplierPlatform.SHOPEE }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.supplierLink.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveSupplierLink', () => {
    it('soft-deletes by setting isArchived', async () => {
      const target = buildLink();
      prisma.supplierLink.findFirst.mockResolvedValue(target);
      prisma.supplierLink.update.mockResolvedValue({ ...target, isArchived: true });

      await service.archiveSupplierLink(SUPPLIER_ID, target.id);

      expect(prisma.supplierLink.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { isArchived: true },
      });
    });
  });
});
