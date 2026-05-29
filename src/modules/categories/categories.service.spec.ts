import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';

import { CategoriesService } from './categories.service';
import { PrismaService } from '../../core/database/prisma.service';

const buildCategory = (overrides: Partial<Category> = {}): Category => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Beverages',
  description: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    it('creates a category when the name is free', async () => {
      const created = buildCategory();
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue(created);

      await expect(service.createCategory({ name: 'Beverages' })).resolves.toEqual(created);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Beverages', description: undefined },
      });
    });

    it('rejects a name already used by an active category', async () => {
      prisma.category.findFirst.mockResolvedValue(buildCategory());

      await expect(service.createCategory({ name: 'beverages' })).rejects.toThrow(ConflictException);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('reactivates an archived category with the same name instead of failing', async () => {
      const archived = buildCategory({ isArchived: true });
      prisma.category.findFirst.mockResolvedValue(archived);
      prisma.category.update.mockResolvedValue({ ...archived, isArchived: false });

      await service.createCategory({ name: 'Beverages' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: archived.id },
        data: { name: 'Beverages', description: null, isArchived: false },
      });
      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('getCategory', () => {
    it('throws when the category does not exist or is archived', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.getCategory(buildCategory().id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCategory', () => {
    it('rejects a rename that collides with a different category', async () => {
      const target = buildCategory();
      const other = buildCategory({ id: '22222222-2222-2222-2222-222222222222', name: 'Snacks' });
      prisma.category.findFirst
        .mockResolvedValueOnce(target) // getCategory
        .mockResolvedValueOnce(other); // findCategoryByName

      await expect(service.updateCategory(target.id, { name: 'Snacks' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.category.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveCategory', () => {
    it('soft-deletes by setting isArchived', async () => {
      const target = buildCategory();
      prisma.category.findFirst.mockResolvedValue(target);
      prisma.category.update.mockResolvedValue({ ...target, isArchived: true });

      await service.archiveCategory(target.id);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { isArchived: true },
      });
    });
  });
});
