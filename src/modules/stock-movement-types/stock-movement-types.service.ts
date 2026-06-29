import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateStockMovementTypeDTO } from './dto/create-stock-movement-type.dto';
import { UpdateStockMovementTypeDTO } from './dto/update-stock-movement-type.dto';

@Injectable()
export class StockMovementTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async createStockMovementType(body: CreateStockMovementTypeDTO): Promise<StockMovementType> {
    const { name, description, effect } = body;
    const existing = await this.findStockMovementTypeByName(name);

    if (existing && !existing.isArchived) {
      throw new ConflictException('Stock movement type name already in use');
    }

    if (existing && existing.isArchived) {
      return this.prisma.stockMovementType.update({
        where: { id: existing.id },
        data: { name, description: description ?? null, effect, isArchived: false },
      });
    }

    return this.prisma.stockMovementType.create({ data: { name, description, effect } });
  }

  async getAllStockMovementTypes(): Promise<StockMovementType[]> {
    return this.prisma.stockMovementType.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async getStockMovementType(id: string): Promise<StockMovementType> {
    const movementType = await this.prisma.stockMovementType.findFirst({
      where: { id, isArchived: false },
    });
    if (!movementType) throw new NotFoundException('Stock movement type not found');
    return movementType;
  }

  async updateStockMovementType(
    id: string,
    body: UpdateStockMovementTypeDTO,
  ): Promise<StockMovementType> {
    const current = await this.getStockMovementType(id);

    if (current.systemKey && body.effect && body.effect !== current.effect) {
      throw new BadRequestException('System stock movement type effect cannot be changed');
    }

    if (body.name) {
      const existing = await this.findStockMovementTypeByName(body.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Stock movement type name already in use');
      }
    }

    return this.prisma.stockMovementType.update({ where: { id }, data: body });
  }

  async archiveStockMovementType(id: string): Promise<StockMovementType> {
    const movementType = await this.getStockMovementType(id);
    if (movementType.systemKey) {
      throw new BadRequestException('System stock movement types cannot be archived');
    }

    return this.prisma.stockMovementType.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  private findStockMovementTypeByName(name: string): Promise<StockMovementType | null> {
    return this.prisma.stockMovementType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }
}
