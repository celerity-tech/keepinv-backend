import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Supplier } from '@prisma/client';

import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDTO } from './dto/create-supplier.dto';
import { UpdateSupplierDTO } from './dto/update-supplier.dto';

@Controller('suppliers')
@UseGuards(PassportJwtGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async createSupplier(@Body() body: CreateSupplierDTO): Promise<Supplier> {
    return this.suppliersService.createSupplier(body);
  }

  @Get()
  async getAllSuppliers(): Promise<Supplier[]> {
    return this.suppliersService.getAllSuppliers();
  }

  @Get(':id')
  async getSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<Supplier> {
    return this.suppliersService.getSupplier(id);
  }

  @Patch(':id')
  async updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSupplierDTO,
  ): Promise<Supplier> {
    return this.suppliersService.updateSupplier(id, body);
  }

  @Delete(':id')
  async archiveSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<Supplier> {
    return this.suppliersService.archiveSupplier(id);
  }
}
