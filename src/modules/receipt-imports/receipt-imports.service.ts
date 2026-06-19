import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, StockMovementType, Supplier } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { MIN_CONFIDENCE, ReceiptImportDTO, ReceiptImportItemDTO } from './dto/receipt-import.dto';

type ReceiptImportAction = 'MATCH_PRODUCT' | 'CREATE_PRODUCT' | 'REJECT';

type MatchedProduct = Pick<Product, 'id' | 'name' | 'sku' | 'barcode' | 'quantityOnHand'>;

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
    const items = await Promise.all(
      body.items.map(async (item, index) => this.previewItem(item, index + 1)),
    );

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

      const supplier = await this.findOrCreateSupplier(tx, body);
      let createdProducts = 0;
      let matchedProducts = 0;
      let stockMovementsCreated = 0;

      const committedItems: PreviewItem[] = [];

      for (const [index, item] of body.items.entries()) {
        const product = await this.findOrCreateProduct(tx, item, body, supplier.id, index + 1);
        const wasCreated = product.quantityOnHand === 0 && preview.items[index].action === 'CREATE_PRODUCT';

        if (wasCreated) createdProducts += 1;
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
          action: wasCreated ? 'CREATE_PRODUCT' : 'MATCH_PRODUCT',
          matchedProduct: updated,
          reason: wasCreated ? 'Product created from receipt line' : 'Product matched and stocked in',
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

  private async previewItem(item: ReceiptImportItemDTO, line: number): Promise<PreviewItem> {
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

    const product = await this.findProduct(item, normalizedName);

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
    if (item.confidence.name < MIN_CONFIDENCE) fields.push('name');
    if (item.confidence.quantity < MIN_CONFIDENCE) fields.push('quantity');
    if (item.confidence.unitCost < MIN_CONFIDENCE) fields.push('unitCost');
    return fields;
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
  ): Promise<MatchedProduct> {
    const normalizedName = this.normalizeName(item.normalizedName || item.rawName);
    const existing = await this.findProduct(item, normalizedName, tx);
    if (existing) return existing;

    return tx.product.create({
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
      .slice(0, 24);
    const receiptPart = body.receipt.receiptNumber?.replace(/[^A-Za-z0-9]/g, '').slice(-8) || 'RECEIPT';
    return `RCPT-${receiptPart}-${line.toString().padStart(3, '0')}-${prefix || 'ITEM'}`.slice(0, 64);
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
}
