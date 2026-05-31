import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupplierLink, SupplierPlatform } from '@prisma/client';

import { PrismaService } from '../../../core/database/prisma.service';
import { SuppliersService } from '../suppliers.service';
import { CreateSupplierLinkDTO } from './dto/create-supplier-link.dto';
import { UpdateSupplierLinkDTO } from './dto/update-supplier-link.dto';

@Injectable()
export class SupplierLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async createSupplierLink(
    supplierId: string,
    body: CreateSupplierLinkDTO,
  ): Promise<SupplierLink> {
    await this.suppliersService.getSupplier(supplierId);

    const existing = await this.findLinkByPlatform(supplierId, body.platform);
    if (existing && !existing.isArchived) {
      throw new ConflictException(`A ${body.platform} link already exists for this supplier`);
    }

    // The (supplierId, platform) unique constraint also covers archived rows, so a hard
    // create would crash. Reactivate the archived link with the new details instead.
    if (existing && existing.isArchived) {
      return this.prisma.supplierLink.update({
        where: { id: existing.id },
        data: { url: body.url, label: body.label ?? null, isArchived: false },
      });
    }

    return this.prisma.supplierLink.create({ data: { ...body, supplierId } });
  }

  async getSupplierLinks(supplierId: string): Promise<SupplierLink[]> {
    await this.suppliersService.getSupplier(supplierId);
    return this.prisma.supplierLink.findMany({
      where: { supplierId, isArchived: false },
      orderBy: { platform: 'asc' },
    });
  }

  async getSupplierLink(supplierId: string, linkId: string): Promise<SupplierLink> {
    const link = await this.prisma.supplierLink.findFirst({
      where: { id: linkId, supplierId, isArchived: false },
    });
    if (!link) throw new NotFoundException('Supplier link not found');
    return link;
  }

  async updateSupplierLink(
    supplierId: string,
    linkId: string,
    body: UpdateSupplierLinkDTO,
  ): Promise<SupplierLink> {
    await this.getSupplierLink(supplierId, linkId);

    if (body.platform) {
      const existing = await this.findLinkByPlatform(supplierId, body.platform);
      if (existing && existing.id !== linkId) {
        throw new ConflictException(`A ${body.platform} link already exists for this supplier`);
      }
    }

    return this.prisma.supplierLink.update({ where: { id: linkId }, data: body });
  }

  async archiveSupplierLink(supplierId: string, linkId: string): Promise<SupplierLink> {
    await this.getSupplierLink(supplierId, linkId);
    return this.prisma.supplierLink.update({
      where: { id: linkId },
      data: { isArchived: true },
    });
  }

  // The unique constraint spans archived rows too, so this lookup ignores isArchived and
  // lets callers decide whether an existing row means "conflict" or "reactivate".
  private findLinkByPlatform(
    supplierId: string,
    platform: SupplierPlatform,
  ): Promise<SupplierLink | null> {
    return this.prisma.supplierLink.findFirst({ where: { supplierId, platform } });
  }
}
