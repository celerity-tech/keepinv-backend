import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { CreateProductDTO } from './dto/create-product.dto';
import { UpdateProductDTO } from './dto/update-product.dto';
import { FilterProductsDTO } from './dto/filter-products.dto';

// Always expose the related catalog rows so the client can render names without extra calls.
const PRODUCT_INCLUDE: Prisma.ProductInclude = {
  category: true,
  supplier: true,
  location: true,
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(body: CreateProductDTO): Promise<Product> {
    const { sku, barcode, categoryId, supplierId, locationId } = body;

    await this.validateRelations(categoryId, supplierId, locationId);

    // `quantityOnHand` is intentionally never written here — it stays at the DB default (0)
    // and will be owned by the stock-movement ledger once that module lands.
    const existing = await this.prisma.product.findFirst({ where: { sku } });
    if (existing && !existing.isArchived) {
      throw new ConflictException('Product SKU already in use');
    }

    if (barcode) {
      await this.ensureBarcodeAvailable(barcode, existing?.id);
    }

    // The DB `sku`/`barcode` unique constraints also cover archived rows, so a hard create
    // would crash. Reactivate the archived row that owns this SKU instead of failing.
    if (existing) {
      return this.prisma.product.update({
        where: { id: existing.id },
        data: { ...body, isArchived: false },
      });
    }

    return this.prisma.product.create({ data: body });
  }

  async getAllProducts(filter: FilterProductsDTO): Promise<PaginatedResponse<Product>> {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);

    const { data, total } = await this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);
      const rows = await tx.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      const count = await tx.product.count({ where });
      return { data: rows, total: count };
    });

    return {
      data,
      meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, isArchived: false },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async updateProduct(id: string, body: UpdateProductDTO): Promise<Product> {
    await this.getProduct(id);
    await this.validateRelations(body.categoryId, body.supplierId, body.locationId);

    if (body.sku) await this.ensureSkuAvailable(body.sku, id);
    if (body.barcode) await this.ensureBarcodeAvailable(body.barcode, id);

    return this.prisma.product.update({ where: { id }, data: body });
  }

  async archiveProduct(id: string): Promise<Product> {
    await this.getProduct(id);
    return this.prisma.product.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  private buildWhere(filter: FilterProductsDTO): Prisma.ProductWhereInput {
    const { search, categoryId, locationId, lowStock } = filter;
    const where: Prisma.ProductWhereInput = { isArchived: false };

    if (categoryId) where.categoryId = categoryId;
    if (locationId) where.locationId = locationId;

    // Re-order audit: only rows that declared a threshold and have dropped to/below it.
    if (lowStock) {
      where.reorderPoint = { not: null };
      where.quantityOnHand = { lte: this.prisma.product.fields.reorderPoint };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // Category is required; supplier and location are optional and only checked when supplied.
  private async validateRelations(
    categoryId?: string,
    supplierId?: string,
    locationId?: string,
  ): Promise<void> {
    if (categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, isArchived: false },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    if (supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: supplierId, isArchived: false },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, isArchived: false },
      });
      if (!location) throw new NotFoundException('Location not found');
    }
  }

  // A unique value may only be reused by the same row (e.g. an archived row being reactivated).
  private async ensureSkuAvailable(sku: string, exceptId?: string): Promise<void> {
    const owner = await this.prisma.product.findFirst({ where: { sku } });
    if (owner && owner.id !== exceptId) {
      throw new ConflictException('Product SKU already in use');
    }
  }

  private async ensureBarcodeAvailable(barcode: string, exceptId?: string): Promise<void> {
    const owner = await this.prisma.product.findFirst({ where: { barcode } });
    if (owner && owner.id !== exceptId) {
      throw new ConflictException('Product barcode already in use');
    }
  }
}
