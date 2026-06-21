import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Category } from '@prisma/client';

import { CategoriesService } from './categories.service';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { UpdateCategoryDTO } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async createCategory(@Body() body: CreateCategoryDTO): Promise<Category> {
    return this.categoriesService.createCategory(body);
  }

  @Get()
  async getAllCategories(): Promise<Category[]> {
    return this.categoriesService.getAllCategories();
  }

  @Get(':id')
  async getCategory(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.categoriesService.getCategory(id);
  }

  @Patch(':id')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDTO,
  ): Promise<Category> {
    return this.categoriesService.updateCategory(id, body);
  }

  @Delete(':id')
  async archiveCategory(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.categoriesService.archiveCategory(id);
  }
}
