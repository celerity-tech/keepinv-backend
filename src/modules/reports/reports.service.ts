import { Injectable } from '@nestjs/common';
import { Prisma, ProductUnitStatus } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { STOCK_COUNTED_STATUSES } from '../../common/constants/product-unit-status.constants';
import {
  ATTENTION_UNIT_INCLUDE,
  AttentionUnit,
  AttentionUnitRow,
  InventoryDashboardReport,
} from './types/reports.types';

/** Statuses that no longer represent a physical asset we track (gone from the shelf for good). */
const RETIRED_UNIT_STATUSES: ProductUnitStatus[] = [
  ProductUnitStatus.SOLD,
  ProductUnitStatus.DISPOSED,
];

const ATTENTION_PREVIEW_LIMIT = 8;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single-snapshot inventory dashboard: stock KPIs, unit-status breakdown, assets by category and
   * location, and the "needs attention" buckets (missing / misplaced / untagged / disposed). Every
   * query runs inside one RepeatableRead transaction after setTenantContext, so the whole report is
   * one consistent, tenant-scoped view (raw SQL would bypass RLS, so it is deliberately avoided).
   */
  async getInventoryDashboardReport(): Promise<InventoryDashboardReport> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.prisma.setTenantContext(tx);

        // Queries run sequentially: a single interactive-transaction connection cannot serve
        // concurrent queries, so Promise.all here would be unsafe.
        const products = await tx.product.findMany({
          where: { isArchived: false },
          select: { costPrice: true, quantityOnHand: true, reorderPoint: true },
        });
        const statusGroups = await tx.productUnit.groupBy({
          by: ['status'],
          where: { product: { isArchived: false } },
          _count: { _all: true },
        });
        const categoryGroups = await tx.product.groupBy({
          by: ['categoryId'],
          where: { isArchived: false },
          _sum: { quantityOnHand: true },
          _count: { _all: true },
        });

        const totals = this.buildTotals(products, statusGroups);
        const unitStatus = statusGroups.map((group) => ({
          status: group.status,
          count: group._count._all,
        }));
        const byCategory = await this.buildByCategory(tx, categoryGroups);
        const byLocation = await this.buildByLocation(tx);
        const attention = await this.buildAttention(tx);

        return {
          generatedAt: new Date().toISOString(),
          totals,
          unitStatus,
          byCategory,
          byLocation,
          attention,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private buildTotals(
    products: { costPrice: Prisma.Decimal; quantityOnHand: number; reorderPoint: number | null }[],
    statusGroups: { status: ProductUnitStatus; _count: { _all: number } }[],
  ): InventoryDashboardReport['totals'] {
    let stockValue = new Prisma.Decimal(0);
    let lowStockCount = 0;
    for (const product of products) {
      stockValue = stockValue.plus(product.costPrice.mul(product.quantityOnHand));
      if (product.reorderPoint !== null && product.quantityOnHand <= product.reorderPoint) {
        lowStockCount += 1;
      }
    }

    const trackedUnitCount = statusGroups
      .filter((group) => !RETIRED_UNIT_STATUSES.includes(group.status))
      .reduce((sum, group) => sum + group._count._all, 0);

    return {
      productCount: products.length,
      trackedUnitCount,
      stockValue: stockValue.toNumber(),
      lowStockCount,
    };
  }

  private async buildByCategory(
    tx: Prisma.TransactionClient,
    groups: {
      categoryId: string;
      _sum: { quantityOnHand: number | null };
      _count: { _all: number };
    }[],
  ): Promise<InventoryDashboardReport['byCategory']> {
    if (groups.length === 0) return [];

    const categories = await tx.category.findMany({
      where: { id: { in: groups.map((group) => group.categoryId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((category) => [category.id, category.name]));

    return groups
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: nameById.get(group.categoryId) ?? 'Unknown category',
        quantity: group._sum.quantityOnHand ?? 0,
        productCount: group._count._all,
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  private async buildByLocation(
    tx: Prisma.TransactionClient,
  ): Promise<InventoryDashboardReport['byLocation']> {
    // Non-serialized stock lives as a product quantity at the product's location; serialized stock
    // lives as on-hand units at each unit's location. Summing both, keyed by location, avoids the
    // double count that a single product-quantity sum would produce for serialized items.
    const productGroups = await tx.product.groupBy({
      by: ['locationId'],
      where: { isArchived: false, isSerialized: false },
      _sum: { quantityOnHand: true },
    });
    const unitGroups = await tx.productUnit.groupBy({
      by: ['locationId'],
      where: {
        status: { in: [...STOCK_COUNTED_STATUSES] },
        product: { isArchived: false, isSerialized: true },
      },
      _count: { _all: true },
    });

    const quantityByLocation = new Map<string | null, number>();
    const add = (locationId: string | null, quantity: number) => {
      quantityByLocation.set(locationId, (quantityByLocation.get(locationId) ?? 0) + quantity);
    };
    for (const group of productGroups) add(group.locationId, group._sum.quantityOnHand ?? 0);
    for (const group of unitGroups) add(group.locationId, group._count._all);

    const locationIds = [...quantityByLocation.keys()].filter((id): id is string => id !== null);
    const locations = locationIds.length
      ? await tx.location.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(locations.map((location) => [location.id, location.name]));

    return [...quantityByLocation.entries()]
      .map(([locationId, quantity]) => ({
        locationId,
        locationName: locationId ? (nameById.get(locationId) ?? 'Unknown location') : 'No location',
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  private async buildAttention(
    tx: Prisma.TransactionClient,
  ): Promise<InventoryDashboardReport['attention']> {
    const missing = await this.buildAttentionBucket(tx, { status: ProductUnitStatus.MISSING });
    const misplaced = await this.buildAttentionBucket(tx, { status: ProductUnitStatus.MISPLACED });
    const untagged = await this.buildAttentionBucket(tx, {
      rfidTag: null,
      status: { notIn: [...RETIRED_UNIT_STATUSES, ProductUnitStatus.LOST] },
      product: { isSerialized: true },
    });
    const disposedCount = await tx.productUnit.count({
      where: { status: ProductUnitStatus.DISPOSED, product: { isArchived: false } },
    });

    return { missing, misplaced, untagged, disposedCount };
  }

  private async buildAttentionBucket(
    tx: Prisma.TransactionClient,
    where: Prisma.ProductUnitWhereInput,
  ): Promise<{ count: number; units: AttentionUnit[] }> {
    // Every bucket is scoped to live products; merge any product filter the caller supplied.
    const scoped: Prisma.ProductUnitWhereInput = {
      ...where,
      product: { isArchived: false, ...(where.product as Prisma.ProductWhereInput | undefined) },
    };

    const count = await tx.productUnit.count({ where: scoped });
    const rows = await tx.productUnit.findMany({
      where: scoped,
      include: ATTENTION_UNIT_INCLUDE,
      orderBy: [{ product: { name: 'asc' } }, { updatedAt: 'desc' }],
      take: ATTENTION_PREVIEW_LIMIT,
    });

    return { count, units: rows.map((row) => this.toAttentionUnit(row)) };
  }

  private toAttentionUnit(row: AttentionUnitRow): AttentionUnit {
    return {
      id: row.id,
      productName: row.product.name,
      productSku: row.product.sku,
      identifier: row.rfidTag ?? row.serialNumber ?? row.assetTag ?? null,
      locationName: row.location?.name ?? null,
      status: row.status,
    };
  }
}
