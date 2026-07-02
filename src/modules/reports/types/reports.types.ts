import type { Prisma, ProductUnitStatus } from '@prisma/client';

/** Include used for the small "needs attention" unit previews on the dashboard. */
export const ATTENTION_UNIT_INCLUDE = {
  product: { select: { name: true, sku: true } },
  location: { select: { name: true } },
} satisfies Prisma.ProductUnitInclude;

export type AttentionUnitRow = Prisma.ProductUnitGetPayload<{
  include: typeof ATTENTION_UNIT_INCLUDE;
}>;

export interface AttentionUnit {
  id: string;
  productName: string;
  productSku: string;
  /** rfidTag, else serialNumber, else assetTag — whichever identifies the unit. */
  identifier: string | null;
  locationName: string | null;
  status: ProductUnitStatus;
}

export interface AttentionBucket {
  count: number;
  units: AttentionUnit[];
}

export interface InventoryDashboardReport {
  generatedAt: string;
  totals: {
    productCount: number;
    /** Physical serialized assets still in the system (excludes sold and disposed units). */
    trackedUnitCount: number;
    /** Total cost value of on-hand stock, in pesos. */
    stockValue: number;
    /** Products at or below their reorder point. */
    lowStockCount: number;
  };
  unitStatus: { status: ProductUnitStatus; count: number }[];
  byCategory: { categoryId: string; categoryName: string; quantity: number; productCount: number }[];
  byLocation: { locationId: string | null; locationName: string; quantity: number }[];
  attention: {
    missing: AttentionBucket;
    misplaced: AttentionBucket;
    untagged: AttentionBucket;
    disposedCount: number;
  };
}
