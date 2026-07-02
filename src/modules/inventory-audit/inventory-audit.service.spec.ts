import { Test, TestingModule } from '@nestjs/testing';
import { InventoryAuditService } from './inventory-audit.service';
import { PrismaService } from '../../core/database/prisma.service';

const AUDIT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LOCATION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('InventoryAuditService', () => {
  let service: InventoryAuditService;
  // The transaction client is a separate stub from the base client so we can assert what runs
  // inside the completion transaction.
  let tx: {
    inventoryAudit: { updateMany: jest.Mock };
    inventoryAuditScan: { findMany: jest.Mock; updateMany: jest.Mock };
    productUnit: { findMany: jest.Mock; updateMany: jest.Mock };
    product: { update: jest.Mock };
    stockMovement: { createMany: jest.Mock };
    stockMovementType: { findFirst: jest.Mock };
  };
  let prisma: {
    location: { findFirst: jest.Mock };
    inventoryAudit: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    inventoryAuditScan: { createMany: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    productUnit: { findMany: jest.Mock; groupBy: jest.Mock };
    setTenantContext: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      inventoryAudit: { updateMany: jest.fn() },
      inventoryAuditScan: { findMany: jest.fn(), updateMany: jest.fn() },
      productUnit: { findMany: jest.fn(), updateMany: jest.fn() },
      product: { update: jest.fn() },
      stockMovement: { createMany: jest.fn() },
      stockMovementType: { findFirst: jest.fn() },
    };

    prisma = {
      location: { findFirst: jest.fn() },
      inventoryAudit: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      inventoryAuditScan: { createMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      productUnit: { findMany: jest.fn(), groupBy: jest.fn() },
      setTenantContext: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
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
      id: AUDIT_ID,
      locationId: LOCATION_ID,
      status: 'IN_PROGRESS',
    });

    await expect(service.addScans(AUDIT_ID, { rawInput: '   ' })).rejects.toThrow(
      'No scan tags supplied',
    );
  });

  describe('completeAudit', () => {
    it('marks an unscanned expected unit MISSING and writes a -1 adjustment', async () => {
      // getAuditHeader sees it in progress; the final getInventoryAudit sees it completed.
      prisma.inventoryAudit.findUnique
        .mockResolvedValueOnce({ id: AUDIT_ID, auditNo: 'IA-1', locationId: LOCATION_ID, status: 'IN_PROGRESS' })
        .mockResolvedValue({
          id: AUDIT_ID,
          auditNo: 'IA-1',
          locationId: LOCATION_ID,
          status: 'COMPLETED',
          scans: [],
          location: { id: LOCATION_ID },
          user: { id: USER_ID },
        });
      prisma.productUnit.findMany.mockResolvedValue([]); // findExpectedUnits in the final report

      tx.inventoryAudit.updateMany.mockResolvedValue({ count: 1 }); // claim wins
      tx.inventoryAuditScan.findMany.mockResolvedValue([]); // no scans
      tx.productUnit.findMany
        .mockResolvedValueOnce([]) // resolveProductUnitsByScanValue (no scan values)
        .mockResolvedValueOnce([{ id: 'unit-1', status: 'IN_STOCK', productId: 'prod-1' }]); // expected here
      tx.stockMovementType.findFirst.mockResolvedValue({ id: 'adj-type' });
      tx.product.update
        .mockResolvedValueOnce({ quantityOnHand: 5 }) // lock (increment 0)
        .mockResolvedValueOnce({ quantityOnHand: 4 }); // net -1
      tx.productUnit.updateMany.mockResolvedValue({ count: 1 }); // CAS survives
      tx.stockMovement.createMany.mockResolvedValue({ count: 1 });

      await service.completeAudit(USER_ID, AUDIT_ID);

      expect(tx.productUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: 'IN_STOCK' },
        data: { status: 'MISSING' },
      });
      expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            quantityChange: -1,
            quantityAfter: 4,
            productId: 'prod-1',
            productUnitId: 'unit-1',
            userId: USER_ID,
          }),
        ],
      });
    });

    it('bails without stock changes when another completer already won the claim', async () => {
      prisma.inventoryAudit.findUnique
        .mockResolvedValueOnce({ id: AUDIT_ID, auditNo: 'IA-1', locationId: LOCATION_ID, status: 'IN_PROGRESS' })
        .mockResolvedValue({
          id: AUDIT_ID,
          auditNo: 'IA-1',
          locationId: LOCATION_ID,
          status: 'COMPLETED',
          scans: [],
          location: { id: LOCATION_ID },
          user: { id: USER_ID },
        });
      prisma.productUnit.findMany.mockResolvedValue([]);
      tx.inventoryAudit.updateMany.mockResolvedValue({ count: 0 }); // lost the race

      await service.completeAudit(USER_ID, AUDIT_ID);

      expect(tx.productUnit.updateMany).not.toHaveBeenCalled();
      expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    });
  });
});
