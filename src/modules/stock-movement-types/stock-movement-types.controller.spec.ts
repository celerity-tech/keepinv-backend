import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementEffect } from '@prisma/client';

import { StockMovementTypesController } from './stock-movement-types.controller';
import { StockMovementTypesService } from './stock-movement-types.service';

describe('StockMovementTypesController', () => {
  let controller: StockMovementTypesController;
  let service: Record<keyof StockMovementTypesService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createStockMovementType: jest.fn(),
      getAllStockMovementTypes: jest.fn(),
      getStockMovementType: jest.fn(),
      updateStockMovementType: jest.fn(),
      archiveStockMovementType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementTypesController],
      providers: [{ provide: StockMovementTypesService, useValue: service }],
    }).compile();

    controller = module.get<StockMovementTypesController>(StockMovementTypesController);
  });

  it('delegates creation to the service', async () => {
    const body = { name: 'Damaged Stock', effect: StockMovementEffect.DECREASE };

    await controller.createStockMovementType(body);

    expect(service.createStockMovementType).toHaveBeenCalledWith(body);
  });

  it('delegates listing to the service', async () => {
    await controller.getAllStockMovementTypes();

    expect(service.getAllStockMovementTypes).toHaveBeenCalled();
  });
});
