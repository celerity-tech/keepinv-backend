import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { CheckoutPosDTO } from './dto/checkout-pos.dto';
import { FilterSalesDTO } from './dto/filter-sales.dto';
import { ListProductUnitsDTO } from './dto/list-product-units.dto';
import { SearchPosItemsDTO } from './dto/search-pos-items.dto';
import { VoidSaleDTO } from './dto/void-sale.dto';
import { PosService } from './pos.service';
import { PosSaleListItem, PosSaleResult, PosSearchItem } from './types/pos.types';

@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('search-items')
  async searchItems(@Query() query: SearchPosItemsDTO): Promise<PosSearchItem[]> {
    return this.posService.searchItems(query);
  }

  @Get('products/:id/units')
  async getProductUnits(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListProductUnitsDTO,
  ): Promise<PosSearchItem[]> {
    return this.posService.getProductUnits(id, query);
  }

  @Post('checkout')
  async checkout(
    @Session() session: UserSession,
    @Body() body: CheckoutPosDTO,
  ): Promise<PosSaleResult> {
    return this.posService.checkout(session.user.id, body);
  }

  @Get('sales')
  async getAllSales(
    @Query() filter: FilterSalesDTO,
  ): Promise<PaginatedResponse<PosSaleListItem>> {
    return this.posService.getAllSales(filter);
  }

  @Get('sales/:id')
  async getSale(@Param('id', ParseUUIDPipe) id: string): Promise<PosSaleResult> {
    return this.posService.getSale(id);
  }

  @Post('sales/:id/void')
  async voidSale(
    @Session() session: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VoidSaleDTO,
  ): Promise<PosSaleResult> {
    return this.posService.voidSale(session.user.id, id, body);
  }
}
