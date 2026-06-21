import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Location } from '@prisma/client';

import { LocationsService } from './locations.service';
import { CreateLocationDTO } from './dto/create-location.dto';
import { UpdateLocationDTO } from './dto/update-location.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  async createLocation(@Body() body: CreateLocationDTO): Promise<Location> {
    return this.locationsService.createLocation(body);
  }

  @Get()
  async getAllLocations(): Promise<Location[]> {
    return this.locationsService.getAllLocations();
  }

  @Get(':id')
  async getLocation(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    return this.locationsService.getLocation(id);
  }

  @Patch(':id')
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLocationDTO,
  ): Promise<Location> {
    return this.locationsService.updateLocation(id, body);
  }

  @Delete(':id')
  async archiveLocation(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    return this.locationsService.archiveLocation(id);
  }
}
