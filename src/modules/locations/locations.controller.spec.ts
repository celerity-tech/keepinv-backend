import { Test, TestingModule } from '@nestjs/testing';

import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;
  let service: Record<keyof LocationsService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createLocation: jest.fn(),
      getAllLocations: jest.fn(),
      getLocation: jest.fn(),
      updateLocation: jest.fn(),
      archiveLocation: jest.fn(),
    } as unknown as Record<keyof LocationsService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: service }],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createLocation to the service', async () => {
    const body = { name: 'Warehouse A', code: 'WH-A' };
    await controller.createLocation(body);
    expect(service.createLocation).toHaveBeenCalledWith(body);
  });

  it('delegates getAllLocations to the service', async () => {
    await controller.getAllLocations();
    expect(service.getAllLocations).toHaveBeenCalled();
  });
});
