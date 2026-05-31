import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Location } from '@prisma/client';

import { LocationsService } from './locations.service';
import { PrismaService } from '../../core/database/prisma.service';

const buildLocation = (overrides: Partial<Location> = {}): Location => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Warehouse A',
  code: 'WH-A',
  description: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: {
    location: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      location: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLocation', () => {
    it('creates a location without a code without checking uniqueness', async () => {
      const created = buildLocation({ code: null });
      prisma.location.create.mockResolvedValue(created);

      await expect(service.createLocation({ name: 'Warehouse A' })).resolves.toEqual(created);
      expect(prisma.location.findFirst).not.toHaveBeenCalled();
      expect(prisma.location.create).toHaveBeenCalledWith({
        data: { name: 'Warehouse A', code: undefined, description: undefined },
      });
    });

    it('creates a location when the code is free', async () => {
      const created = buildLocation();
      prisma.location.findFirst.mockResolvedValue(null);
      prisma.location.create.mockResolvedValue(created);

      await expect(service.createLocation({ name: 'Warehouse A', code: 'WH-A' })).resolves.toEqual(
        created,
      );
      expect(prisma.location.create).toHaveBeenCalledWith({
        data: { name: 'Warehouse A', code: 'WH-A', description: undefined },
      });
    });

    it('rejects a code already used by an active location', async () => {
      prisma.location.findFirst.mockResolvedValue(buildLocation());

      await expect(service.createLocation({ name: 'Warehouse A', code: 'WH-A' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.location.create).not.toHaveBeenCalled();
    });

    it('reactivates an archived location with the same code instead of failing', async () => {
      const archived = buildLocation({ isArchived: true });
      prisma.location.findFirst.mockResolvedValue(archived);
      prisma.location.update.mockResolvedValue({ ...archived, isArchived: false });

      await service.createLocation({ name: 'Warehouse A', code: 'WH-A' });

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: archived.id },
        data: {
          name: 'Warehouse A',
          code: 'WH-A',
          description: null,
          isArchived: false,
        },
      });
      expect(prisma.location.create).not.toHaveBeenCalled();
    });
  });

  describe('getLocation', () => {
    it('throws when the location does not exist or is archived', async () => {
      prisma.location.findFirst.mockResolvedValue(null);
      await expect(service.getLocation(buildLocation().id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLocation', () => {
    it('rejects a code change that collides with a different location', async () => {
      const target = buildLocation();
      const other = buildLocation({ id: '22222222-2222-2222-2222-222222222222', code: 'WH-B' });
      prisma.location.findFirst
        .mockResolvedValueOnce(target) // getLocation
        .mockResolvedValueOnce(other); // findLocationByCode

      await expect(service.updateLocation(target.id, { code: 'WH-B' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.location.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveLocation', () => {
    it('soft-deletes by setting isArchived', async () => {
      const target = buildLocation();
      prisma.location.findFirst.mockResolvedValue(target);
      prisma.location.update.mockResolvedValue({ ...target, isArchived: true });

      await service.archiveLocation(target.id);

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: target.id },
        data: { isArchived: true },
      });
    });
  });
});
