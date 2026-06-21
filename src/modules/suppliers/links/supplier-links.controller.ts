import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { SupplierLink } from '@prisma/client';

import { SupplierLinksService } from './supplier-links.service';
import { CreateSupplierLinkDTO } from './dto/create-supplier-link.dto';
import { UpdateSupplierLinkDTO } from './dto/update-supplier-link.dto';

@Controller('suppliers/:supplierId/links')
export class SupplierLinksController {
  constructor(private readonly supplierLinksService: SupplierLinksService) {}

  @Post()
  async createSupplierLink(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() body: CreateSupplierLinkDTO,
  ): Promise<SupplierLink> {
    return this.supplierLinksService.createSupplierLink(supplierId, body);
  }

  @Get()
  async getSupplierLinks(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ): Promise<SupplierLink[]> {
    return this.supplierLinksService.getSupplierLinks(supplierId);
  }

  @Get(':linkId')
  async getSupplierLink(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<SupplierLink> {
    return this.supplierLinksService.getSupplierLink(supplierId, linkId);
  }

  @Patch(':linkId')
  async updateSupplierLink(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() body: UpdateSupplierLinkDTO,
  ): Promise<SupplierLink> {
    return this.supplierLinksService.updateSupplierLink(supplierId, linkId, body);
  }

  @Delete(':linkId')
  async archiveSupplierLink(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<SupplierLink> {
    return this.supplierLinksService.archiveSupplierLink(supplierId, linkId);
  }
}
