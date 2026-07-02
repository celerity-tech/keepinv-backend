import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryAuditScanMode,
  InventoryAuditScanResult,
  InventoryAuditStatus,
  Prisma,
  ProductUnitStatus,
} from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { PaginatedResponse, paginationMeta } from '../../common/responses/paginated-api.response';
import {
  AUDIT_MANAGED_STATUSES,
  STOCK_COUNTED_STATUSES,
} from '../../common/constants/product-unit-status.constants';
import { STOCK_MOVEMENT_SYSTEM_KEY } from '../stock-movement-types/constants/stock-movement-type.constants';
import { getSystemStockMovementTypeId } from '../stock-movement-types/utils/stock-movement-type.utils';
import { CreateInventoryAuditDTO } from './dto/create-inventory-audit.dto';
import { AddInventoryAuditScansDTO } from './dto/add-inventory-audit-scans.dto';
import { FilterInventoryAuditsDTO } from './dto/filter-inventory-audits.dto';
import {
  AuditProductUnit,
  AuditScan,
  AuditWithRelations,
  AddInventoryAuditScansResult,
  INVENTORY_AUDIT_INCLUDE,
  InventoryAuditListItem,
  InventoryAuditReport,
  InventoryAuditSummary,
  PRODUCT_UNIT_AUDIT_INCLUDE,
} from './types/inventory-audit.types';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

const MAX_SCAN_VALUES_PER_BATCH = 1000;

/** A status transition an audit intends to apply to one unit on completion. */
interface UnitTransition {
  unitId: string;
  productId: string;
  from: ProductUnitStatus;
  to: ProductUnitStatus;
  delta: number;
}

@Injectable()
export class InventoryAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createInventoryAudit(
    userId: string,
    body: CreateInventoryAuditDTO,
  ): Promise<InventoryAuditReport> {
    await this.validateLocation(body.locationId);
    const scanBatch = this.extractScanValues(body);

    const audit = await this.prisma.inventoryAudit.create({
      data: {
        auditNo: this.generateAuditNo(),
        locationId: body.locationId,
        userId,
      },
    });

    if (scanBatch.scanValues.length === 0) {
      return this.getInventoryAudit(audit.id);
    }

    const result = await this.addScans(audit.id, {
      tags: scanBatch.scanValues,
      scanMode: body.scanMode,
    });
    return result.audit;
  }

  async getAllInventoryAudits(
    filter: FilterInventoryAuditsDTO,
  ): Promise<PaginatedResponse<InventoryAuditListItem>> {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);

    const { audits, total } = await this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);
      const rows = await tx.inventoryAudit.findMany({
        where,
        include: INVENTORY_AUDIT_INCLUDE,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      const count = await tx.inventoryAudit.count({ where });
      return { audits: rows as AuditWithRelations[], total: count };
    });

    // One grouped count for the whole page instead of a per-audit expected-units query (was N+1).
    const expectedByLocation = await this.countExpectedUnitsByLocation(
      audits.map((audit) => audit.locationId),
    );

    const data = audits.map((audit) =>
      this.buildListItem(audit, expectedByLocation.get(audit.locationId) ?? 0),
    );

    return { data, meta: paginationMeta(total, page, limit) };
  }

  private async countExpectedUnitsByLocation(
    locationIds: string[],
  ): Promise<Map<string, number>> {
    const distinct = [...new Set(locationIds)];
    if (distinct.length === 0) return new Map();

    const groups = await this.prisma.productUnit.groupBy({
      by: ['locationId'],
      where: { locationId: { in: distinct }, product: { isArchived: false } },
      _count: { _all: true },
    });

    return new Map(
      groups
        .filter((group): group is typeof group & { locationId: string } => group.locationId !== null)
        .map((group) => [group.locationId, group._count._all]),
    );
  }

  async getInventoryAudit(id: string): Promise<InventoryAuditReport> {
    const audit = await this.prisma.inventoryAudit.findUnique({
      where: { id },
      include: INVENTORY_AUDIT_INCLUDE,
    });
    if (!audit) throw new NotFoundException('Inventory audit not found');

    const expectedUnits = await this.findExpectedUnits(audit.locationId);
    return this.buildReport(audit as AuditWithRelations, expectedUnits);
  }

  async getExpectedAssets(locationId: string): Promise<{
    locationId: string;
    expectedCount: number;
    assets: AuditProductUnit[];
  }> {
    await this.validateLocation(locationId);

    const assets = await this.findExpectedUnits(locationId);
    return { locationId, expectedCount: assets.length, assets };
  }

  async addScans(
    auditId: string,
    body: AddInventoryAuditScansDTO,
  ): Promise<AddInventoryAuditScansResult> {
    const audit = await this.getAuditHeader(auditId);
    this.ensureAuditInProgress(audit.status);

    const { scanValues, duplicateInputCount, ignoredEmptyCount } = this.extractScanValues(body);
    if (scanValues.length === 0) {
      throw new BadRequestException('No scan tags supplied');
    }

    const unitsByScanValue = await this.resolveProductUnitsByScanValue(scanValues, this.prisma);
    const scanMode = body.scanMode ?? InventoryAuditScanMode.RFID;

    const created = await this.prisma.inventoryAuditScan.createMany({
      data: scanValues.map((scanValue) => {
        const productUnit = unitsByScanValue.get(scanValue);
        return {
          auditId,
          scanValue,
          scanMode,
          productUnitId: productUnit?.id,
          result: this.resolveScanResult(productUnit, audit.locationId),
        };
      }),
      skipDuplicates: true,
    });

    return {
      acceptedCount: created.count,
      duplicateCount: duplicateInputCount + (scanValues.length - created.count),
      ignoredEmptyCount,
      audit: await this.getInventoryAudit(auditId),
    };
  }

  async completeAudit(userId: string, id: string): Promise<InventoryAuditReport> {
    const audit = await this.getAuditHeader(id);
    if (audit.status === InventoryAuditStatus.CANCELLED) {
      throw new BadRequestException('Cancelled audits cannot be completed');
    }
    if (audit.status === InventoryAuditStatus.COMPLETED) {
      return this.getInventoryAudit(id);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);

      // Claim the audit atomically: whoever flips IN_PROGRESS -> COMPLETED first wins, so a
      // concurrent second completer sees count 0 and bails without re-applying any stock changes.
      const claimed = await tx.inventoryAudit.updateMany({
        where: { id, status: InventoryAuditStatus.IN_PROGRESS },
        data: { status: InventoryAuditStatus.COMPLETED, completedAt: new Date() },
      });
      if (claimed.count === 0) return;

      const { unitsByScanValue } = await this.refreshScanResults(id, audit.locationId, tx);
      await this.reconcileUnitStatuses(tx, audit, unitsByScanValue, userId);
    });

    return this.getInventoryAudit(id);
  }

  /**
   * Persists what the count found onto the units themselves: unmatched expected units become
   * MISSING, recovered units return to IN_STOCK, and units found away from home become MISPLACED.
   * Only touches audit-managed statuses, uses compare-and-set so concurrently sold/changed units are
   * skipped, and writes ADJUSTMENT movements for the units whose on-hand accounting actually shifts.
   */
  private async reconcileUnitStatuses(
    tx: Prisma.TransactionClient,
    audit: { id: string; auditNo: string; locationId: string },
    unitsByScanValue: Map<string, AuditProductUnit>,
    userId: string,
  ): Promise<void> {
    const transitions = await this.planUnitTransitions(tx, audit, unitsByScanValue);
    if (transitions.length === 0) return;

    const adjustmentTypeId = await getSystemStockMovementTypeId(
      tx,
      STOCK_MOVEMENT_SYSTEM_KEY.ADJUSTMENT,
    );
    const movements: Prisma.StockMovementCreateManyInput[] = [];

    // Group by product so on-hand nets to one update per product; process products in a stable order
    // and lock the product row before its units (product -> unit), matching POS to avoid deadlocks.
    const byProduct = this.groupTransitionsByProduct(transitions);
    for (const productId of [...byProduct.keys()].sort()) {
      const planned = byProduct.get(productId)!.sort((a, b) => a.unitId.localeCompare(b.unitId));

      const locked = await tx.product.update({
        where: { id: productId },
        data: { quantityOnHand: { increment: 0 } },
      });

      const applied: UnitTransition[] = [];
      for (const transition of planned) {
        const changed = await tx.productUnit.updateMany({
          where: { id: transition.unitId, status: transition.from },
          data: { status: transition.to },
        });
        if (changed.count === 1) applied.push(transition);
      }

      const netDelta = applied.reduce((sum, transition) => sum + transition.delta, 0);
      let finalQty = locked.quantityOnHand;
      if (netDelta !== 0) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { quantityOnHand: { increment: netDelta } },
        });
        if (updated.quantityOnHand < 0) {
          throw new BadRequestException('Audit completion would drive stock below zero');
        }
        finalQty = updated.quantityOnHand;
      }

      // Ledger rows only for transitions that shift on-hand; running quantityAfter reconstructs the
      // per-unit snapshots from the product's final balance.
      let running = finalQty - netDelta;
      for (const transition of applied) {
        if (transition.delta === 0) continue;
        running += transition.delta;
        movements.push({
          stockMovementTypeId: adjustmentTypeId,
          quantityChange: transition.delta,
          quantityAfter: running,
          note: `Inventory audit ${audit.auditNo}`,
          productId,
          productUnitId: transition.unitId,
          locationId: audit.locationId,
          userId,
        });
      }
    }

    if (movements.length > 0) {
      await tx.stockMovement.createMany({ data: movements });
    }
  }

  private async planUnitTransitions(
    tx: Prisma.TransactionClient,
    audit: { locationId: string },
    unitsByScanValue: Map<string, AuditProductUnit>,
  ): Promise<UnitTransition[]> {
    // Units resolved by a scan, deduped by unit id. A scanned unit whose home is this location is a
    // recovery (MATCHED); one whose home is elsewhere was found away from home (MISPLACED).
    const scannedById = new Map<string, AuditProductUnit>();
    for (const unit of unitsByScanValue.values()) {
      if (AUDIT_MANAGED_STATUSES.has(unit.status) && !unit.product.isArchived) {
        scannedById.set(unit.id, unit);
      }
    }

    const expectedHere = await tx.productUnit.findMany({
      where: {
        locationId: audit.locationId,
        status: { in: [...AUDIT_MANAGED_STATUSES] },
        product: { isArchived: false },
      },
      select: { id: true, status: true, productId: true },
    });

    const transitions: UnitTransition[] = [];

    // Group 1: units that belong here. Scanned -> recovered to IN_STOCK; unscanned IN_STOCK -> MISSING.
    for (const unit of expectedHere) {
      const to = scannedById.has(unit.id)
        ? ProductUnitStatus.IN_STOCK
        : unit.status === ProductUnitStatus.IN_STOCK
          ? ProductUnitStatus.MISSING
          : unit.status; // MISSING/MISPLACED unscanned stay put (no phantom demotion)
      this.pushTransition(transitions, unit.id, unit.productId, unit.status, to);
    }

    // Group 2: units scanned here but assigned to another location -> MISPLACED (keep their home).
    for (const unit of scannedById.values()) {
      if (unit.locationId === audit.locationId) continue;
      this.pushTransition(transitions, unit.id, unit.productId, unit.status, ProductUnitStatus.MISPLACED);
    }

    return transitions;
  }

  private pushTransition(
    transitions: UnitTransition[],
    unitId: string,
    productId: string,
    from: ProductUnitStatus,
    to: ProductUnitStatus,
  ): void {
    if (from === to) return; // pure no-op, skip the DB round-trip entirely
    const delta =
      (STOCK_COUNTED_STATUSES.has(to) ? 1 : 0) - (STOCK_COUNTED_STATUSES.has(from) ? 1 : 0);
    transitions.push({ unitId, productId, from, to, delta });
  }

  private groupTransitionsByProduct(
    transitions: UnitTransition[],
  ): Map<string, UnitTransition[]> {
    const byProduct = new Map<string, UnitTransition[]>();
    for (const transition of transitions) {
      const list = byProduct.get(transition.productId) ?? [];
      list.push(transition);
      byProduct.set(transition.productId, list);
    }
    return byProduct;
  }

  async cancelAudit(id: string): Promise<InventoryAuditReport> {
    const audit = await this.getAuditHeader(id);
    if (audit.status === InventoryAuditStatus.COMPLETED) {
      throw new BadRequestException('Completed audits cannot be cancelled');
    }
    if (audit.status === InventoryAuditStatus.CANCELLED) {
      return this.getInventoryAudit(id);
    }

    await this.prisma.inventoryAudit.update({
      where: { id },
      data: { status: InventoryAuditStatus.CANCELLED },
    });

    return this.getInventoryAudit(id);
  }

  private buildWhere(filter: FilterInventoryAuditsDTO): Prisma.InventoryAuditWhereInput {
    const { locationId, status, dateFrom, dateTo } = filter;
    const where: Prisma.InventoryAuditWhereInput = {};

    if (locationId) where.locationId = locationId;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.startedAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    return where;
  }

  private async validateLocation(locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, isArchived: false },
    });
    if (!location) throw new NotFoundException('Location not found');
  }

  private async getAuditHeader(id: string) {
    const audit = await this.prisma.inventoryAudit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException('Inventory audit not found');
    return audit;
  }

  private ensureAuditInProgress(status: InventoryAuditStatus): void {
    if (status !== InventoryAuditStatus.IN_PROGRESS) {
      throw new BadRequestException('Only in-progress audits can accept scans');
    }
  }

  private async findExpectedUnits(
    locationId: string,
    client: PrismaClientLike = this.prisma,
  ): Promise<AuditProductUnit[]> {
    return client.productUnit.findMany({
      where: this.expectedUnitWhere(locationId),
      include: PRODUCT_UNIT_AUDIT_INCLUDE,
      orderBy: [{ product: { name: 'asc' } }, { assetTag: 'asc' }, { rfidTag: 'asc' }],
    });
  }

  private expectedUnitWhere(locationId: string): Prisma.ProductUnitWhereInput {
    return {
      locationId,
      product: { isArchived: false },
    };
  }

  private buildReport(
    audit: AuditWithRelations,
    expectedUnits: AuditProductUnit[],
  ): InventoryAuditReport {
    const matched = audit.scans.filter(
      (scan) => scan.result === InventoryAuditScanResult.MATCHED,
    );
    const unknownTag = audit.scans.filter(
      (scan) => scan.result === InventoryAuditScanResult.UNKNOWN_TAG,
    );
    const misplaced = audit.scans.filter(
      (scan) => scan.result === InventoryAuditScanResult.MISPLACED,
    );

    const matchedUnitIds = this.productUnitIdSet(matched);
    const missing = expectedUnits.filter((unit) => !matchedUnitIds.has(unit.id));

    return {
      ...audit,
      summary: this.buildSummary(audit.scans, expectedUnits.length),
      buckets: { matched, missing, unknownTag, misplaced },
    };
  }

  private buildListItem(
    audit: AuditWithRelations,
    expectedCount: number,
  ): InventoryAuditListItem {
    const { scans, ...rest } = audit;
    return { ...rest, summary: this.buildSummary(scans, expectedCount) };
  }

  private buildSummary(scans: AuditScan[], expectedCount: number): InventoryAuditSummary {
    const matchedUnitIds = this.productUnitIdSet(
      scans.filter((scan) => scan.result === InventoryAuditScanResult.MATCHED),
    );

    return {
      expectedCount,
      scannedCount: scans.length,
      matchedCount: matchedUnitIds.size,
      // Matched units are, by definition, expected here, so this never goes negative.
      missingCount: Math.max(0, expectedCount - matchedUnitIds.size),
      unknownTagCount: scans.filter(
        (scan) => scan.result === InventoryAuditScanResult.UNKNOWN_TAG,
      ).length,
      misplacedCount: scans.filter(
        (scan) => scan.result === InventoryAuditScanResult.MISPLACED,
      ).length,
    };
  }

  private productUnitIdSet(scans: AuditScan[]): Set<string> {
    return new Set(
      scans
        .map((scan) => scan.productUnitId)
        .filter((productUnitId): productUnitId is string => Boolean(productUnitId)),
    );
  }

  private async resolveProductUnitsByScanValue(
    scanValues: string[],
    client: PrismaClientLike,
  ): Promise<Map<string, AuditProductUnit>> {
    const scanValueSet = new Set(scanValues);
    const units = await client.productUnit.findMany({
      where: {
        OR: [
          { rfidTag: { in: scanValues } },
          { assetTag: { in: scanValues } },
          { serialNumber: { in: scanValues } },
          { product: { barcode: { in: scanValues } } },
        ],
      },
      include: PRODUCT_UNIT_AUDIT_INCLUDE,
    });

    const candidates = new Map<string, Map<string, AuditProductUnit>>();
    const addCandidate = (scanValue: string | null, unit: AuditProductUnit) => {
      if (!scanValue || !scanValueSet.has(scanValue)) return;
      const byUnitId = candidates.get(scanValue) ?? new Map<string, AuditProductUnit>();
      byUnitId.set(unit.id, unit);
      candidates.set(scanValue, byUnitId);
    };

    for (const unit of units) {
      addCandidate(unit.rfidTag, unit);
      addCandidate(unit.assetTag, unit);
      addCandidate(unit.serialNumber, unit);
      addCandidate(unit.product.barcode, unit);
    }

    const resolved = new Map<string, AuditProductUnit>();
    for (const [scanValue, byUnitId] of candidates.entries()) {
      if (byUnitId.size === 1) {
        resolved.set(scanValue, Array.from(byUnitId.values())[0]);
      }
    }

    return resolved;
  }

  private resolveScanResult(
    productUnit: AuditProductUnit | undefined,
    auditLocationId: string,
  ): InventoryAuditScanResult {
    if (!productUnit) return InventoryAuditScanResult.UNKNOWN_TAG;
    return productUnit.locationId === auditLocationId
      ? InventoryAuditScanResult.MATCHED
      : InventoryAuditScanResult.MISPLACED;
  }

  private async refreshScanResults(
    auditId: string,
    auditLocationId: string,
    client: Prisma.TransactionClient,
  ): Promise<{ unitsByScanValue: Map<string, AuditProductUnit> }> {
    const scans = await client.inventoryAuditScan.findMany({ where: { auditId } });
    const scanValues = scans.map((scan) => scan.scanValue);
    const unitsByScanValue = await this.resolveProductUnitsByScanValue(scanValues, client);

    // Collapse the per-scan updates into one updateMany per distinct (productUnitId, result) pair
    // instead of a write per scan row.
    const groups = new Map<string, { productUnitId: string | null; result: InventoryAuditScanResult; ids: string[] }>();
    for (const scan of scans) {
      const productUnit = unitsByScanValue.get(scan.scanValue);
      const productUnitId = productUnit?.id ?? null;
      const result = this.resolveScanResult(productUnit, auditLocationId);
      const key = `${productUnitId ?? ''}|${result}`;
      const group = groups.get(key) ?? { productUnitId, result, ids: [] };
      group.ids.push(scan.id);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      await client.inventoryAuditScan.updateMany({
        where: { id: { in: group.ids } },
        data: { productUnitId: group.productUnitId, result: group.result },
      });
    }

    return { unitsByScanValue };
  }

  private extractScanValues(body: Pick<AddInventoryAuditScansDTO, 'tags' | 'rawInput'>): {
    scanValues: string[];
    duplicateInputCount: number;
    ignoredEmptyCount: number;
  } {
    const rawValues = [
      ...(body.tags ?? []).flatMap((tag) => this.splitScanInput(tag)),
      ...this.splitScanInput(body.rawInput ?? ''),
    ];

    let duplicateInputCount = 0;
    let ignoredEmptyCount = 0;
    const unique = new Set<string>();

    for (const rawValue of rawValues) {
      const scanValue = rawValue.trim();
      if (!scanValue) {
        ignoredEmptyCount += 1;
        continue;
      }

      if (unique.has(scanValue)) {
        duplicateInputCount += 1;
        continue;
      }

      unique.add(scanValue);
    }

    const scanValues = Array.from(unique);
    if (scanValues.length > MAX_SCAN_VALUES_PER_BATCH) {
      throw new BadRequestException(
        `Scan batches are limited to ${MAX_SCAN_VALUES_PER_BATCH} unique tags`,
      );
    }

    return { scanValues, duplicateInputCount, ignoredEmptyCount };
  }

  private splitScanInput(value: string): string[] {
    const trimmed = value.trim();
    return trimmed ? trimmed.split(/[\s,;]+/g) : [];
  }

  private generateAuditNo(): string {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `IA-${stamp}-${suffix}`;
  }
}
