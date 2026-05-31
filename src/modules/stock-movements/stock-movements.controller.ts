import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StockMovement } from '@prisma/client';

import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDTO } from './dto/create-stock-movement.dto';
import { FilterStockMovementsDTO } from './dto/filter-stock-movements.dto';

@Controller('stock-movements')
@UseGuards(PassportJwtGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  async recordStockMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateStockMovementDTO,
  ): Promise<StockMovement> {
    return this.stockMovementsService.recordStockMovement(user.id, body);
  }

  @Get()
  async getAllStockMovements(
    @Query() filter: FilterStockMovementsDTO,
  ): Promise<PaginatedResponse<StockMovement>> {
    return this.stockMovementsService.getAllStockMovements(filter);
  }

  @Get(':id')
  async getStockMovement(@Param('id', ParseUUIDPipe) id: string): Promise<StockMovement> {
    return this.stockMovementsService.getStockMovement(id);
  }
}
