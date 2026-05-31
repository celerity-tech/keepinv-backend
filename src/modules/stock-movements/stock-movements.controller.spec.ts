import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementType } from '@prisma/client';

import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateStockMovementDTO } from './dto/create-stock-movement.dto';
import { FilterStockMovementsDTO } from './dto/filter-stock-movements.dto';

const user: AuthenticatedUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@example.com',
  role: 'ADMIN',
};

describe('StockMovementsController', () => {
  let controller: StockMovementsController;
  let service: Record<keyof StockMovementsService, jest.Mock>;

  beforeEach(async () => {
    service = {
      recordStockMovement: jest.fn(),
      getAllStockMovements: jest.fn(),
      getStockMovement: jest.fn(),
    } as unknown as Record<keyof StockMovementsService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementsController],
      providers: [{ provide: StockMovementsService, useValue: service }],
    }).compile();

    controller = module.get<StockMovementsController>(StockMovementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('records a movement using the authenticated user id', async () => {
    const body = {
      productId: '11111111-1111-1111-1111-111111111111',
      type: StockMovementType.PURCHASE,
      quantity: 5,
    } as CreateStockMovementDTO;

    await controller.recordStockMovement(user, body);

    expect(service.recordStockMovement).toHaveBeenCalledWith(user.id, body);
  });

  it('delegates getAllStockMovements with the filter query', async () => {
    const filter = { page: 1, limit: 10 } as FilterStockMovementsDTO;
    await controller.getAllStockMovements(filter);
    expect(service.getAllStockMovements).toHaveBeenCalledWith(filter);
  });
});
