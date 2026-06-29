import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';

import { StockMovementTypesService } from './stock-movement-types.service';
import { CreateStockMovementTypeDTO } from './dto/create-stock-movement-type.dto';
import { UpdateStockMovementTypeDTO } from './dto/update-stock-movement-type.dto';

@Controller('stock-movement-types')
export class StockMovementTypesController {
  constructor(private readonly stockMovementTypesService: StockMovementTypesService) {}

  @Post()
  async createStockMovementType(
    @Body() body: CreateStockMovementTypeDTO,
  ): Promise<StockMovementType> {
    return this.stockMovementTypesService.createStockMovementType(body);
  }

  @Get()
  async getAllStockMovementTypes(): Promise<StockMovementType[]> {
    return this.stockMovementTypesService.getAllStockMovementTypes();
  }

  @Get(':id')
  async getStockMovementType(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StockMovementType> {
    return this.stockMovementTypesService.getStockMovementType(id);
  }

  @Patch(':id')
  async updateStockMovementType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockMovementTypeDTO,
  ): Promise<StockMovementType> {
    return this.stockMovementTypesService.updateStockMovementType(id, body);
  }

  @Delete(':id')
  async archiveStockMovementType(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StockMovementType> {
    return this.stockMovementTypesService.archiveStockMovementType(id);
  }
}
