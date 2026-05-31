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
  UseGuards,
} from '@nestjs/common';
import { Product } from '@prisma/client';

import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { ProductsService } from './products.service';
import { CreateProductDTO } from './dto/create-product.dto';
import { UpdateProductDTO } from './dto/update-product.dto';
import { FilterProductsDTO } from './dto/filter-products.dto';

@Controller('products')
@UseGuards(PassportJwtGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async createProduct(@Body() body: CreateProductDTO): Promise<Product> {
    return this.productsService.createProduct(body);
  }

  @Get()
  async getAllProducts(@Query() filter: FilterProductsDTO): Promise<PaginatedResponse<Product>> {
    return this.productsService.getAllProducts(filter);
  }

  @Get(':id')
  async getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.getProduct(id);
  }

  @Patch(':id')
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDTO,
  ): Promise<Product> {
    return this.productsService.updateProduct(id, body);
  }

  @Delete(':id')
  async archiveProduct(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.archiveProduct(id);
  }
}
