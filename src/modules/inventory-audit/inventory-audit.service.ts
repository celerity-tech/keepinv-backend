import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryAuditScanMode,
  InventoryAuditScanResult,
  InventoryAuditStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
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
  PRODUCT_UNIT_AUDIT_INCLUDE,
} from './types/inventory-audit.types';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

const MAX_SCAN_VALUES_PER_BATCH = 1000;

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
      return { audits: rows, total: count };
    });

    const data = await Promise.all(
      audits.map(async (audit) => {
        const auditWithRelations = audit as AuditWithRelations;
        const expectedUnits = await this.findExpectedUnits(auditWithRelations.locationId);
        return this.buildListItem(auditWithRelations, expectedUnits);
      }),
    );

    return {
      data,
      meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
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

  async completeAudit(id: string): Promise<InventoryAuditReport> {
    const audit = await this.getAuditHeader(id);
    if (audit.status === InventoryAuditStatus.CANCELLED) {
      throw new BadRequestException('Cancelled audits cannot be completed');
    }
    if (audit.status === InventoryAuditStatus.COMPLETED) {
      return this.getInventoryAudit(id);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);
      await this.refreshScanResults(audit.id, audit.locationId, tx);
      await tx.inventoryAudit.update({
        where: { id },
        data: {
          status: InventoryAuditStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    return this.getInventoryAudit(id);
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
      summary: this.buildSummary(audit.scans, expectedUnits),
      buckets: { matched, missing, unknownTag, misplaced },
    };
  }

  private buildListItem(
    audit: AuditWithRelations,
    expectedUnits: AuditProductUnit[],
  ): InventoryAuditListItem {
    return {
      id: audit.id,
      auditNo: audit.auditNo,
      status: audit.status,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      organizationId: audit.organizationId,
      locationId: audit.locationId,
      userId: audit.userId,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
      location: audit.location,
      user: audit.user,
      summary: this.buildSummary(audit.scans, expectedUnits),
    };
  }

  private buildSummary(
    scans: AuditScan[],
    expectedUnits: AuditProductUnit[],
  ) {
    const matchedUnitIds = this.productUnitIdSet(
      scans.filter((scan) => scan.result === InventoryAuditScanResult.MATCHED),
    );

    return {
      expectedCount: expectedUnits.length,
      scannedCount: scans.length,
      matchedCount: matchedUnitIds.size,
      missingCount: expectedUnits.filter((unit) => !matchedUnitIds.has(unit.id)).length,
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
  ): Promise<void> {
    const scans = await client.inventoryAuditScan.findMany({ where: { auditId } });
    const scanValues = scans.map((scan) => scan.scanValue);
    const unitsByScanValue = await this.resolveProductUnitsByScanValue(scanValues, client);

    for (const scan of scans) {
      const productUnit = unitsByScanValue.get(scan.scanValue);
      await client.inventoryAuditScan.update({
        where: { id: scan.id },
        data: {
          productUnitId: productUnit?.id ?? null,
          result: this.resolveScanResult(productUnit, auditLocationId),
        },
      });
    }
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
