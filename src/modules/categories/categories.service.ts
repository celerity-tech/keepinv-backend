import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { UpdateCategoryDTO } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(body: CreateCategoryDTO): Promise<Category> {
    const { name, description } = body;

    const existing = await this.findCategoryByName(name);
    if (existing && !existing.isArchived) {
      throw new ConflictException('Category name already in use');
    }

    // The DB `name` unique constraint also covers archived rows, so a hard create
    // would crash. Reactivate the archived row instead of failing the request.
    if (existing && existing.isArchived) {
      return this.prisma.category.update({
        where: { id: existing.id },
        data: { name, description: description ?? null, isArchived: false },
      });
    }

    return this.prisma.category.create({ data: { name, description } });
  }

  async getAllCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, isArchived: false },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(id: string, body: UpdateCategoryDTO): Promise<Category> {
    await this.getCategory(id);

    if (body.name) {
      const existing = await this.findCategoryByName(body.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Category name already in use');
      }
    }

    return this.prisma.category.update({ where: { id }, data: body });
  }

  async archiveCategory(id: string): Promise<Category> {
    await this.getCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  // Case-insensitive lookup so "Beverages" and "beverages" are treated as the same name,
  // while the original casing is still stored for display.
  private findCategoryByName(name: string): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }
}
