import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Location } from '@prisma/client';

import { PrismaService } from '../../core/database/prisma.service';
import { CreateLocationDTO } from './dto/create-location.dto';
import { UpdateLocationDTO } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLocation(body: CreateLocationDTO): Promise<Location> {
    const { name, code, description } = body;

    // Only `code` is unique; names may repeat across locations.
    if (code) {
      const existing = await this.findLocationByCode(code);
      if (existing && !existing.isArchived) {
        throw new ConflictException('Location code already in use');
      }

      // The DB `code` unique constraint also covers archived rows, so a hard create
      // would crash. Reactivate the archived row instead of failing the request.
      if (existing && existing.isArchived) {
        return this.prisma.location.update({
          where: { id: existing.id },
          data: {
            name,
            code,
            description: description ?? null,
            isArchived: false,
          },
        });
      }
    }

    return this.prisma.location.create({ data: { name, code, description } });
  }

  async getAllLocations(): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async getLocation(id: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: { id, isArchived: false },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async updateLocation(id: string, body: UpdateLocationDTO): Promise<Location> {
    await this.getLocation(id);

    if (body.code) {
      const existing = await this.findLocationByCode(body.code);
      if (existing && existing.id !== id) {
        throw new ConflictException('Location code already in use');
      }
    }

    return this.prisma.location.update({ where: { id }, data: body });
  }

  async archiveLocation(id: string): Promise<Location> {
    await this.getLocation(id);
    return this.prisma.location.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  private findLocationByCode(code: string): Promise<Location | null> {
    return this.prisma.location.findFirst({ where: { code } });
  }
}
