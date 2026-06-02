import type { Prisma } from '@prisma/client';

export const PRODUCT_UNIT_AUDIT_INCLUDE = {
  product: true,
  location: true,
} satisfies Prisma.ProductUnitInclude;

export const INVENTORY_AUDIT_SCAN_INCLUDE = {
  productUnit: {
    include: PRODUCT_UNIT_AUDIT_INCLUDE,
  },
} satisfies Prisma.InventoryAuditScanInclude;

export const INVENTORY_AUDIT_INCLUDE = {
  location: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  scans: {
    include: INVENTORY_AUDIT_SCAN_INCLUDE,
    orderBy: { scannedAt: 'asc' },
  },
} satisfies Prisma.InventoryAuditInclude;

export type AuditProductUnit = Prisma.ProductUnitGetPayload<{
  include: typeof PRODUCT_UNIT_AUDIT_INCLUDE;
}>;

export type AuditScan = Prisma.InventoryAuditScanGetPayload<{
  include: typeof INVENTORY_AUDIT_SCAN_INCLUDE;
}>;

export type AuditWithRelations = Prisma.InventoryAuditGetPayload<{
  include: typeof INVENTORY_AUDIT_INCLUDE;
}>;

export interface InventoryAuditSummary {
  expectedCount: number;
  scannedCount: number;
  matchedCount: number;
  missingCount: number;
  unknownTagCount: number;
  misplacedCount: number;
}

export interface InventoryAuditReport extends AuditWithRelations {
  summary: InventoryAuditSummary;
  buckets: {
    matched: AuditScan[];
    missing: AuditProductUnit[];
    unknownTag: AuditScan[];
    misplaced: AuditScan[];
  };
}

export type InventoryAuditListItem = Omit<AuditWithRelations, 'scans'> & {
  summary: InventoryAuditSummary;
};

export interface AddInventoryAuditScansResult {
  acceptedCount: number;
  duplicateCount: number;
  ignoredEmptyCount: number;
  audit: InventoryAuditReport;
}
