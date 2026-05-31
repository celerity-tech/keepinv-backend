import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SupplierLinksService } from './links/supplier-links.service';
import { SupplierLinksController } from './links/supplier-links.controller';

@Module({
  controllers: [SuppliersController, SupplierLinksController],
  providers: [SuppliersService, SupplierLinksService],
  exports: [SuppliersService, SupplierLinksService],
})
export class SuppliersModule {}
