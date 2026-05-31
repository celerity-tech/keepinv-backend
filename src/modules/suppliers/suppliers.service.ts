import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateSupplierDTO } from './dto/create-supplier.dto';
import { UpdateSupplierDTO } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  // Reads embed only the supplier's active links, ordered by platform for stable output.
  private readonly activeLinksInclude: Prisma.SupplierInclude = {
    links: { where: { isArchived: false }, orderBy: { platform: 'asc' } },
  };

  constructor(private readonly prisma: PrismaService) {}

  async createSupplier(body: CreateSupplierDTO): Promise<Supplier> {
    return this.prisma.supplier.create({ data: body });
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
      include: this.activeLinksInclude,
    });
  }

  async getSupplier(id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, isArchived: false },
      include: this.activeLinksInclude,
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async updateSupplier(id: string, body: UpdateSupplierDTO): Promise<Supplier> {
    await this.getSupplier(id);
    return this.prisma.supplier.update({ where: { id }, data: body });
  }

  async archiveSupplier(id: string): Promise<Supplier> {
    await this.getSupplier(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { isArchived: true },
    });
  }
}
