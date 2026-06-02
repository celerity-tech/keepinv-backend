import { Test, TestingModule } from '@nestjs/testing';
import { InventoryAuditService } from './inventory-audit.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('InventoryAuditService', () => {
  let service: InventoryAuditService;
  let prisma: {
    location: { findFirst: jest.Mock };
    inventoryAudit: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    inventoryAuditScan: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    productUnit: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      inventoryAudit: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      inventoryAuditScan: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      productUnit: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryAuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<InventoryAuditService>(InventoryAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects scan batches with no usable tags', async () => {
    prisma.inventoryAudit.findUnique.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      locationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      status: 'IN_PROGRESS',
    });

    await expect(
      service.addScans('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { rawInput: '   ' }),
    ).rejects.toThrow('No scan tags supplied');
  });
});
