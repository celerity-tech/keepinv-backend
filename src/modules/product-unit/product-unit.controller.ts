import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { ProductUnitService } from './product-unit.service';
import { RegisterProductUnitsDTO } from './dto/register-product-units.dto';
import { FilterProductUnitsDTO } from './dto/filter-product-units.dto';
import { UpdateProductUnitDTO } from './dto/update-product-unit.dto';
import { WriteProductUnitTagDTO } from './dto/write-product-unit-tag.dto';
import { ChangeProductUnitStatusDTO } from './dto/change-product-unit-status.dto';
import { RetireProductUnitDTO } from './dto/retire-product-unit.dto';
import {
  ProductUnitStatusChangeResult,
  ProductUnitWithRelations,
  RegisterProductUnitsResult,
} from './types/product-unit.types';

@Controller('product-units')
export class ProductUnitController {
  constructor(private readonly productUnitService: ProductUnitService) {}

  @Post('register')
  async registerProductUnits(
    @Session() session: UserSession,
    @Body() body: RegisterProductUnitsDTO,
  ): Promise<RegisterProductUnitsResult> {
    return this.productUnitService.registerProductUnits(session.user.id, body);
  }

  @Get()
  async getAllProductUnits(
    @Query() filter: FilterProductUnitsDTO,
  ): Promise<PaginatedResponse<ProductUnitWithRelations>> {
    return this.productUnitService.getAllProductUnits(filter);
  }

  @Patch(':id')
  async updateProductUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductUnitDTO,
  ): Promise<ProductUnitWithRelations> {
    return this.productUnitService.updateProductUnit(id, body);
  }

  @Post(':id/write-tag')
  async writeProductUnitTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WriteProductUnitTagDTO,
  ): Promise<ProductUnitWithRelations> {
    return this.productUnitService.writeProductUnitTag(id, body);
  }

  @Post(':id/status')
  async changeProductUnitStatus(
    @Session() session: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeProductUnitStatusDTO,
  ): Promise<ProductUnitStatusChangeResult> {
    return this.productUnitService.changeProductUnitStatus(session.user.id, id, body);
  }

  @Delete(':id')
  async retireProductUnit(
    @Session() session: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RetireProductUnitDTO = {},
  ): Promise<ProductUnitStatusChangeResult> {
    return this.productUnitService.retireProductUnit(session.user.id, id, body);
  }

  @Get(':id')
  async getProductUnit(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductUnitWithRelations> {
    return this.productUnitService.getProductUnit(id);
  }
}
