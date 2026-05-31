import { Test, TestingModule } from '@nestjs/testing';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { FilterProductsDTO } from './dto/filter-products.dto';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: Record<keyof ProductsService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createProduct: jest.fn(),
      getAllProducts: jest.fn(),
      getProduct: jest.fn(),
      updateProduct: jest.fn(),
      archiveProduct: jest.fn(),
    } as unknown as Record<keyof ProductsService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createProduct to the service', async () => {
    const body = { name: 'Cola 1L', sku: 'SKU-001', categoryId: 'cat-1' };
    await controller.createProduct(body);
    expect(service.createProduct).toHaveBeenCalledWith(body);
  });

  it('delegates getAllProducts with the filter query', async () => {
    const filter = { page: 1, limit: 10, search: 'cola' } as FilterProductsDTO;
    await controller.getAllProducts(filter);
    expect(service.getAllProducts).toHaveBeenCalledWith(filter);
  });
});
