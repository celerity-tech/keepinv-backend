import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { PaginatedResponse } from '../../common/responses/paginated-api.response';
import { InventoryAuditService } from './inventory-audit.service';
import { CreateInventoryAuditDTO } from './dto/create-inventory-audit.dto';
import { AddInventoryAuditScansDTO } from './dto/add-inventory-audit-scans.dto';
import { FilterInventoryAuditsDTO } from './dto/filter-inventory-audits.dto';
import { ExpectedAssetsQueryDTO } from './dto/expected-assets-query.dto';
import {
  AddInventoryAuditScansResult,
  AuditProductUnit,
  InventoryAuditListItem,
  InventoryAuditReport,
} from './types/inventory-audit.types';

@Controller('inventory-audits')
@UseGuards(PassportJwtGuard)
export class InventoryAuditController {
  constructor(private readonly inventoryAuditService: InventoryAuditService) {}

  @Post()
  async createInventoryAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInventoryAuditDTO,
  ): Promise<InventoryAuditReport> {
    return this.inventoryAuditService.createInventoryAudit(user.id, body);
  }

  @Get()
  async getAllInventoryAudits(
    @Query() filter: FilterInventoryAuditsDTO,
  ): Promise<PaginatedResponse<InventoryAuditListItem>> {
    return this.inventoryAuditService.getAllInventoryAudits(filter);
  }

  @Get('expected-assets')
  async getExpectedAssets(
    @Query() query: ExpectedAssetsQueryDTO,
  ): Promise<{ locationId: string; expectedCount: number; assets: AuditProductUnit[] }> {
    return this.inventoryAuditService.getExpectedAssets(query.locationId);
  }

  @Get(':id')
  async getInventoryAudit(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryAuditReport> {
    return this.inventoryAuditService.getInventoryAudit(id);
  }

  @Post(':id/scans')
  async addScans(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddInventoryAuditScansDTO,
  ): Promise<AddInventoryAuditScansResult> {
    return this.inventoryAuditService.addScans(id, body);
  }

  @Post(':id/complete')
  async completeAudit(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryAuditReport> {
    return this.inventoryAuditService.completeAudit(id);
  }

  @Post(':id/cancel')
  async cancelAudit(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryAuditReport> {
    return this.inventoryAuditService.cancelAudit(id);
  }
}
