import { Test, TestingModule } from '@nestjs/testing';
import { SupplierPlatform } from '@prisma/client';

import { SupplierLinksController } from './supplier-links.controller';
import { SupplierLinksService } from './supplier-links.service';

const SUPPLIER_ID = '11111111-1111-1111-1111-111111111111';
const LINK_ID = '22222222-2222-2222-2222-222222222222';

describe('SupplierLinksController', () => {
  let controller: SupplierLinksController;
  let service: Record<keyof SupplierLinksService, jest.Mock>;

  beforeEach(async () => {
    service = {
      createSupplierLink: jest.fn(),
      getSupplierLinks: jest.fn(),
      getSupplierLink: jest.fn(),
      updateSupplierLink: jest.fn(),
      archiveSupplierLink: jest.fn(),
    } as unknown as Record<keyof SupplierLinksService, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierLinksController],
      providers: [{ provide: SupplierLinksService, useValue: service }],
    }).compile();

    controller = module.get<SupplierLinksController>(SupplierLinksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createSupplierLink to the service', async () => {
    const body = { platform: SupplierPlatform.SHOPEE, url: 'https://shopee.ph/acme' };
    await controller.createSupplierLink(SUPPLIER_ID, body);
    expect(service.createSupplierLink).toHaveBeenCalledWith(SUPPLIER_ID, body);
  });

  it('delegates archiveSupplierLink to the service', async () => {
    await controller.archiveSupplierLink(SUPPLIER_ID, LINK_ID);
    expect(service.archiveSupplierLink).toHaveBeenCalledWith(SUPPLIER_ID, LINK_ID);
  });
});
