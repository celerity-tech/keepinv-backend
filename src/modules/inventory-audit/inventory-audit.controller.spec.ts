import { Test, TestingModule } from '@nestjs/testing';
import { InventoryAuditController } from './inventory-audit.controller';
import { InventoryAuditService } from './inventory-audit.service';

describe('InventoryAuditController', () => {
  let controller: InventoryAuditController;
  let service: {
    createInventoryAudit: jest.Mock;
    getAllInventoryAudits: jest.Mock;
    getExpectedAssets: jest.Mock;
    getInventoryAudit: jest.Mock;
    addScans: jest.Mock;
    completeAudit: jest.Mock;
    cancelAudit: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createInventoryAudit: jest.fn(),
      getAllInventoryAudits: jest.fn(),
      getExpectedAssets: jest.fn(),
      getInventoryAudit: jest.fn(),
      addScans: jest.fn(),
      completeAudit: jest.fn(),
      cancelAudit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryAuditController],
      providers: [{ provide: InventoryAuditService, useValue: service }],
    }).compile();

    controller = module.get<InventoryAuditController>(InventoryAuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes scan batches to the service', async () => {
    const result = { acceptedCount: 1 };
    service.addScans.mockResolvedValue(result);

    await expect(
      controller.addScans('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { tags: ['EPC-001'] }),
    ).resolves.toBe(result);
    expect(service.addScans).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      tags: ['EPC-001'],
    });
  });
});
