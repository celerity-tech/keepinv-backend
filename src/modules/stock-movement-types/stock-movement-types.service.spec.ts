import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementEffect, StockMovementType } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { StockMovementTypesService } from './stock-movement-types.service';

const buildMovementType = (
  overrides: Partial<StockMovementType> = {},
): StockMovementType => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Purchase',
  description: null,
  effect: StockMovementEffect.INCREASE,
  systemKey: null,
  isArchived: false,
  organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('StockMovementTypesService', () => {
  let service: StockMovementTypesService;
  let prisma: {
    stockMovementType: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      stockMovementType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StockMovementTypesService>(StockMovementTypesService);
  });

  it('creates a custom stock movement type', async () => {
    const created = buildMovementType();
    prisma.stockMovementType.findFirst.mockResolvedValue(null);
    prisma.stockMovementType.create.mockResolvedValue(created);

    await expect(
      service.createStockMovementType({
        name: 'Purchase',
        effect: StockMovementEffect.INCREASE,
      }),
    ).resolves.toEqual(created);
    expect(prisma.stockMovementType.create).toHaveBeenCalledWith({
      data: {
        name: 'Purchase',
        description: undefined,
        effect: StockMovementEffect.INCREASE,
      },
    });
  });

  it('rejects a duplicate active name', async () => {
    prisma.stockMovementType.findFirst.mockResolvedValue(buildMovementType());

    await expect(
      service.createStockMovementType({
        name: 'purchase',
        effect: StockMovementEffect.INCREASE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('reactivates an archived custom type', async () => {
    const archived = buildMovementType({ isArchived: true });
    prisma.stockMovementType.findFirst.mockResolvedValue(archived);
    prisma.stockMovementType.update.mockResolvedValue({ ...archived, isArchived: false });

    await service.createStockMovementType({
      name: 'Purchase',
      effect: StockMovementEffect.INCREASE,
    });

    expect(prisma.stockMovementType.update).toHaveBeenCalledWith({
      where: { id: archived.id },
      data: {
        name: 'Purchase',
        description: null,
        effect: StockMovementEffect.INCREASE,
        isArchived: false,
      },
    });
  });

  it('throws when the type does not exist or is archived', async () => {
    prisma.stockMovementType.findFirst.mockResolvedValue(null);

    await expect(service.getStockMovementType('missing')).rejects.toThrow(NotFoundException);
  });

  it('prevents changing the effect of a system type', async () => {
    prisma.stockMovementType.findFirst.mockResolvedValue(
      buildMovementType({ systemKey: 'SALE', effect: StockMovementEffect.DECREASE }),
    );

    await expect(
      service.updateStockMovementType(buildMovementType().id, {
        effect: StockMovementEffect.INCREASE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents archiving a system type', async () => {
    prisma.stockMovementType.findFirst.mockResolvedValue(
      buildMovementType({ systemKey: 'SALE' }),
    );

    await expect(
      service.archiveStockMovementType(buildMovementType().id),
    ).rejects.toThrow(BadRequestException);
  });

  it('archives a custom type without deleting its history', async () => {
    const movementType = buildMovementType();
    prisma.stockMovementType.findFirst.mockResolvedValue(movementType);
    prisma.stockMovementType.update.mockResolvedValue({
      ...movementType,
      isArchived: true,
    });

    await service.archiveStockMovementType(movementType.id);

    expect(prisma.stockMovementType.update).toHaveBeenCalledWith({
      where: { id: movementType.id },
      data: { isArchived: true },
    });
  });
});
