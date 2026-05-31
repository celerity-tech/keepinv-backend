import { Test, TestingModule } from '@nestjs/testing';

import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: Record<keyof SuppliersService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createSupplier: jest.fn(),
      getAllSuppliers: jest.fn(),
      getSupplier: jest.fn(),
      updateSupplier: jest.fn(),
      archiveSupplier: jest.fn(),
    } as unknown as Record<keyof SuppliersService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [{ provide: SuppliersService, useValue: service }],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createSupplier to the service', async () => {
    const body = { name: 'Acme Supplies' };
    await controller.createSupplier(body);
    expect(service.createSupplier).toHaveBeenCalledWith(body);
  });

  it('delegates getAllSuppliers to the service', async () => {
    await controller.getAllSuppliers();
    expect(service.getAllSuppliers).toHaveBeenCalled();
  });
});
