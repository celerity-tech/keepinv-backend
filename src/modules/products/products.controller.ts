import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Product } from '@prisma/client';

import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { ProductsService } from './products.service';
import { CreateProductDTO } from './dto/create-product.dto';
import { UpdateProductDTO } from './dto/update-product.dto';
import { FilterProductsDTO } from './dto/filter-products.dto';

/** Accepted image types and the per-file ceiling for a product photo. */
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('products')
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

  // Multipart photo upload (field name `image`). Available on every plan. The file is held in
  // memory and streamed straight to Cloudinary, so no temp file ever touches disk.
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadProductImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: IMAGE_MIME })
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ): Promise<Product> {
    return this.productsService.setProductImage(id, file.buffer);
  }

  @Delete(':id/image')
  async removeProductImage(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.removeProductImage(id);
  }
}
