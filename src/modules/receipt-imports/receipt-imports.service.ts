import { ConflictException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, StockMovementType, Supplier } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../core/database/prisma.service';
import { MIN_CONFIDENCE, ReceiptImportDTO, ReceiptImportItemDTO } from './dto/receipt-import.dto';

type ReceiptImportAction = 'MATCH_PRODUCT' | 'CREATE_PRODUCT' | 'REJECT';

type MatchedProduct = Pick<Product, 'id' | 'name' | 'sku' | 'barcode' | 'quantityOnHand'>;

type ProductMatchMap = {
  byBarcode: Map<string, MatchedProduct>;
  bySku: Map<string, MatchedProduct>;
  byName: Map<string, MatchedProduct>;
};

type PreviewItem = {
  line: number;
  rawName: string;
  normalizedName: string;
  quantity: number;
  unitCost: number;
  action: ReceiptImportAction;
  matchedProduct: MatchedProduct | null;
  reason: string;
};

type ReceiptImportPreview = {
  supplier: {
    action: 'MATCH_SUPPLIER' | 'CREATE_SUPPLIER';
    matchedSupplier: Supplier | null;
  };
  items: PreviewItem[];
  canCommit: boolean;
};

type ReceiptImportCommit = ReceiptImportPreview & {
  createdProducts: number;
  matchedProducts: number;
  stockMovementsCreated: number;
};

type ProductResolution = {
  product: MatchedProduct;
  created: boolean;
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  quantityOnHand: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ReceiptImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async previewReceiptImport(body: ReceiptImportDTO): Promise<ReceiptImportPreview> {
    await this.validateDefaults(body);

    const supplier = await this.findSupplierByName(body.supplier.name);
    const productMatches = await this.buildProductMatchMap(body.items);
    const items = body.items.map((item, index) => this.previewItem(item, index + 1, productMatches));

    return {
      supplier: {
        action: supplier ? 'MATCH_SUPPLIER' : 'CREATE_SUPPLIER',
        matchedSupplier: supplier,
      },
      items,
      canCommit: items.every((item) => item.action !== 'REJECT'),
    };
  }

  async commitReceiptImport(userId: string, body: ReceiptImportDTO): Promise<ReceiptImportCommit> {
    const preview = await this.previewReceiptImport(body);
    const rejected = preview.items.filter((item) => item.action === 'REJECT');

    if (rejected.length > 0) {
      throw new BadRequestException({
        message: 'Receipt import has unclear or invalid item lines',
        items: rejected,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);
      await this.ensureIdempotencyKeyUnused(tx, body);

      const supplier = await this.findOrCreateSupplier(tx, body);
      let createdProducts = 0;
      let matchedProducts = 0;
      let stockMovementsCreated = 0;

      const committedItems: PreviewItem[] = [];

      for (const [index, item] of body.items.entries()) {
        const { product, created } = await this.findOrCreateProduct(tx, item, body, supplier.id, index + 1);

        if (created) createdProducts += 1;
        else matchedProducts += 1;

        const updated = await tx.product.update({
          where: { id: product.id },
          data: {
            costPrice: item.unitCost,
            quantityOnHand: { increment: item.quantity },
            supplierId: supplier.id,
            locationId: body.defaults.locationId,
          },
          select: PRODUCT_SELECT,
        });

        await tx.stockMovement.create({
          data: {
            type: StockMovementType.PURCHASE,
            quantityChange: item.quantity,
            quantityAfter: updated.quantityOnHand,
            note: this.buildMovementNote(body, item),
            productId: updated.id,
            supplierId: supplier.id,
            locationId: body.defaults.locationId,
            userId,
          },
        });

        stockMovementsCreated += 1;
        committedItems.push({
          ...preview.items[index],
          action: created ? 'CREATE_PRODUCT' : 'MATCH_PRODUCT',
          matchedProduct: updated,
          reason: created ? 'Product created from receipt line' : 'Product matched and stocked in',
        });
      }

      return {
        supplier: {
          action: preview.supplier.action,
          matchedSupplier: supplier,
        },
        items: committedItems,
        canCommit: true,
        createdProducts,
        matchedProducts,
        stockMovementsCreated,
      };
    });
  }

  private async validateDefaults(body: ReceiptImportDTO): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: body.defaults.categoryId, isArchived: false },
    });
    if (!category) throw new NotFoundException('Default category not found');

    if (body.defaults.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: body.defaults.locationId, isArchived: false },
      });
      if (!location) throw new NotFoundException('Default location not found');
    }
  }

  private previewItem(item: ReceiptImportItemDTO, line: number, matches: ProductMatchMap): PreviewItem {
    const normalizedName = this.normalizeName(item.normalizedName || item.rawName);
    const lowConfidenceFields = this.getLowConfidenceFields(item);

    if (lowConfidenceFields.length > 0) {
      return {
        line,
        rawName: item.rawName,
        normalizedName,
        quantity: item.quantity,
        unitCost: item.unitCost,
        action: 'REJECT',
        matchedProduct: null,
        reason: `Low confidence fields: ${lowConfidenceFields.join(', ')}`,
      };
    }

    const product = this.findProductInMap(item, normalizedName, matches);

    return {
      line,
      rawName: item.rawName,
      normalizedName,
      quantity: item.quantity,
      unitCost: item.unitCost,
      action: product ? 'MATCH_PRODUCT' : 'CREATE_PRODUCT',
      matchedProduct: product,
      reason: product ? 'Matched by barcode, SKU, or exact normalized name' : 'No existing product match found',
    };
  }

  private getLowConfidenceFields(item: ReceiptImportItemDTO): string[] {
    const fields: string[] = [];
    if (item.confidence.productName < MIN_CONFIDENCE) fields.push('productName');
    if (item.confidence.quantity < MIN_CONFIDENCE) fields.push('quantity');
    if (item.confidence.unitCost < MIN_CONFIDENCE) fields.push('unitCost');
    return fields;
  }

  private async buildProductMatchMap(items: ReceiptImportItemDTO[]): Promise<ProductMatchMap> {
    const barcodes = [...new Set(items.map((item) => item.barcode).filter((value): value is string => Boolean(value)))];
    const skus = [...new Set(items.map((item) => item.sku).filter((value): value is string => Boolean(value)))];
    const names = [...new Set(items.map((item) => this.normalizeName(item.normalizedName || item.rawName)))];

    const [barcodeMatches, skuMatches, nameMatches] = await Promise.all([
      barcodes.length > 0
        ? this.prisma.product.findMany({
            where: { barcode: { in: barcodes }, isArchived: false },
            select: PRODUCT_SELECT,
          })
        : [],
      skus.length > 0
        ? this.prisma.product.findMany({
            where: { sku: { in: skus }, isArchived: false },
            select: PRODUCT_SELECT,
          })
        : [],
      names.length > 0
        ? this.prisma.product.findMany({
            where: { OR: names.map((name) => ({ name: { equals: name, mode: 'insensitive' } })), isArchived: false },
            select: PRODUCT_SELECT,
          })
        : [],
    ]);

    return {
      byBarcode: new Map(
        barcodeMatches.flatMap((product): Array<[string, MatchedProduct]> =>
          product.barcode ? [[product.barcode, product]] : [],
        ),
      ),
      bySku: new Map(skuMatches.map((product): [string, MatchedProduct] => [product.sku, product])),
      byName: new Map(
        nameMatches.map((product): [string, MatchedProduct] => [
          this.normalizeName(product.name).toLowerCase(),
          product,
        ]),
      ),
    };
  }

  private findProductInMap(
    item: ReceiptImportItemDTO,
    normalizedName: string,
    matches: ProductMatchMap,
  ): MatchedProduct | null {
    if (item.barcode) {
      const product = matches.byBarcode.get(item.barcode);
      if (product) return product;
    }

    if (item.sku) {
      const product = matches.bySku.get(item.sku);
      if (product) return product;
    }

    return matches.byName.get(normalizedName.toLowerCase()) ?? null;
  }

  private async ensureIdempotencyKeyUnused(
    tx: Prisma.TransactionClient,
    body: ReceiptImportDTO,
  ): Promise<void> {
    const key = body.source?.idempotencyKey;
    if (!key) return;

    const existing = await tx.stockMovement.findFirst({
      where: { note: { contains: `key=${key}` } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Receipt import idempotency key was already processed');
    }
  }

  private async findOrCreateSupplier(
    tx: Prisma.TransactionClient,
    body: ReceiptImportDTO,
  ): Promise<Supplier> {
    const existing = await tx.supplier.findFirst({
      where: { name: { equals: body.supplier.name, mode: 'insensitive' }, isArchived: false },
    });
    if (existing) return existing;

    return tx.supplier.create({
      data: {
        name: body.supplier.name,
        phone: body.supplier.phone,
        address: body.supplier.address,
      },
    });
  }

  private async findOrCreateProduct(
    tx: Prisma.TransactionClient,
    item: ReceiptImportItemDTO,
    body: ReceiptImportDTO,
    supplierId: string,
    line: number,
  ): Promise<ProductResolution> {
    const normalizedName = this.normalizeName(item.normalizedName || item.rawName);
    const existing = await this.findProduct(item, normalizedName, tx);
    if (existing) return { product: existing, created: false };

    try {
      const product = await tx.product.create({
        data: {
          name: normalizedName,
          sku: item.sku || this.generateSku(normalizedName, body, line),
          barcode: item.barcode,
          brand: item.brand,
          costPrice: item.unitCost,
          sellingPrice: item.sellingPrice ?? this.resolveSellingPrice(item, body),
          reorderPoint: body.defaults.reorderPoint,
          categoryId: body.defaults.categoryId,
          supplierId,
          locationId: body.defaults.locationId,
        },
        select: PRODUCT_SELECT,
      });

      return { product, created: true };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Receipt import generated a product SKU or barcode that already exists');
      }
      throw error;
    }
  }

  private async findProduct(
    item: ReceiptImportItemDTO,
    normalizedName: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<MatchedProduct | null> {
    if (item.barcode) {
      const product = await tx.product.findFirst({
        where: { barcode: item.barcode, isArchived: false },
        select: PRODUCT_SELECT,
      });
      if (product) return product;
    }

    if (item.sku) {
      const product = await tx.product.findFirst({
        where: { sku: item.sku, isArchived: false },
        select: PRODUCT_SELECT,
      });
      if (product) return product;
    }

    return tx.product.findFirst({
      where: { name: { equals: normalizedName, mode: 'insensitive' }, isArchived: false },
      select: PRODUCT_SELECT,
    });
  }

  private findSupplierByName(name: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isArchived: false },
    });
  }

  private resolveSellingPrice(item: ReceiptImportItemDTO, body: ReceiptImportDTO): number {
    const markup = body.defaults.sellingPriceMarkupPercent;
    if (markup === undefined) return 0;
    return Number((item.unitCost * (1 + markup / 100)).toFixed(2));
  }

  private generateSku(name: string, body: ReceiptImportDTO, line: number): string {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 18);
    const receiptPart = body.receipt.receiptNumber?.replace(/[^A-Za-z0-9]/g, '').slice(-8) || 'RECEIPT';
    const uniquePart = body.source?.idempotencyKey?.replace(/[^A-Za-z0-9]/g, '').slice(-8) || randomUUID().slice(0, 8);

    return `RCPT-${receiptPart}-${line.toString().padStart(3, '0')}-${uniquePart}-${prefix || 'ITEM'}`.slice(0, 64);
  }

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  private buildMovementNote(body: ReceiptImportDTO, item: ReceiptImportItemDTO): string {
    const parts = [
      'Hermes receipt import',
      body.receipt.receiptNumber ? `receipt=${body.receipt.receiptNumber}` : null,
      `supplier=${body.supplier.name}`,
      `unitCost=${item.unitCost}`,
      body.source?.idempotencyKey ? `key=${body.source.idempotencyKey}` : null,
    ].filter(Boolean);

    return parts.join(' | ').slice(0, 255);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
