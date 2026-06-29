import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovement, StockMovementEffect } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { CreateStockMovementDTO } from './dto/create-stock-movement.dto';
import { FilterStockMovementsDTO } from './dto/filter-stock-movements.dto';
import { STOCK_MOVEMENT_SYSTEM_KEY } from '../stock-movement-types/constants/stock-movement-type.constants';

// Surface who/where/what for each ledger row so an auditor can read it without extra calls.
const MOVEMENT_INCLUDE: Prisma.StockMovementInclude = {
  product: true,
  productUnit: true,
  supplier: true,
  location: true,
  user: true,
  stockMovementType: true,
};

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordStockMovement(
    userId: string,
    body: CreateStockMovementDTO,
  ): Promise<StockMovement> {
    const { productId, stockMovementTypeId, quantity, note, supplierId, locationId } = body;

    const movementType = await this.prisma.stockMovementType.findFirst({
      where: { id: stockMovementTypeId, isArchived: false },
    });
    if (!movementType) throw new NotFoundException('Stock movement type not found');
    if (movementType.systemKey === STOCK_MOVEMENT_SYSTEM_KEY.TRANSFER) {
      throw new BadRequestException('Transfer movements are not supported yet');
    }

    const delta = this.resolveDelta(movementType.effect, quantity);

    await this.validateRefs(productId, supplierId, locationId);

    // Atomic increment + ledger write in one transaction. The increment is race-safe, and the
    // returned balance is the trustworthy `quantityAfter` snapshot. A negative result throws,
    // which rolls the whole transaction back.
    return this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);

      const updated = await tx.product.update({
        where: { id: productId },
        data: { quantityOnHand: { increment: delta } },
      });

      if (updated.quantityOnHand < 0) {
        throw new BadRequestException('Movement would drive stock below zero');
      }

      return tx.stockMovement.create({
        data: {
          stockMovementTypeId,
          quantityChange: delta,
          quantityAfter: updated.quantityOnHand,
          note,
          productId,
          supplierId,
          locationId,
          userId,
        },
      });
    });
  }

  async getAllStockMovements(
    filter: FilterStockMovementsDTO,
  ): Promise<PaginatedResponse<StockMovement>> {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);

    const { data, total } = await this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx);
      const rows = await tx.stockMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      const count = await tx.stockMovement.count({ where });
      return { data: rows, total: count };
    });

    return {
      data,
      meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getStockMovement(id: string): Promise<StockMovement> {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: MOVEMENT_INCLUDE,
    });
    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }

  // Translates (effect, quantity) into a signed delta and enforces the effect's quantity rules.
  private resolveDelta(effect: StockMovementEffect, quantity: number): number {
    if (effect === StockMovementEffect.ADJUSTMENT) {
      if (quantity === 0) {
        throw new BadRequestException('Adjustment quantity must not be zero');
      }
      return quantity;
    }

    if (quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    return effect === StockMovementEffect.DECREASE ? -quantity : quantity;
  }

  private buildWhere(filter: FilterStockMovementsDTO): Prisma.StockMovementWhereInput {
    const { productId, productUnitId, stockMovementTypeId, dateFrom, dateTo } = filter;
    const where: Prisma.StockMovementWhereInput = {};

    if (productId) where.productId = productId;
    if (productUnitId) where.productUnitId = productUnitId;
    if (stockMovementTypeId) where.stockMovementTypeId = stockMovementTypeId;

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    return where;
  }

  private async validateRefs(
    productId: string,
    supplierId?: string,
    locationId?: string,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
    });
    if (!product) throw new NotFoundException('Product not found');

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
}
