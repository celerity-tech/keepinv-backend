import { Test, TestingModule } from '@nestjs/testing';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: Record<keyof CategoriesService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createCategory: jest.fn(),
      getAllCategories: jest.fn(),
      getCategory: jest.fn(),
      updateCategory: jest.fn(),
      archiveCategory: jest.fn(),
    } as unknown as Record<keyof CategoriesService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createCategory to the service', async () => {
    const body = { name: 'Beverages' };
    await controller.createCategory(body);
    expect(service.createCategory).toHaveBeenCalledWith(body);
  });

  it('delegates getAllCategories to the service', async () => {
    await controller.getAllCategories();
    expect(service.getAllCategories).toHaveBeenCalled();
  });
});
