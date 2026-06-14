import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';

import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { PlatformService, ProvisionResult } from './platform.service';

// Operator-only endpoints for manual tenant provisioning (no public/self-service signup).
@Controller('platform')
@UseGuards(PassportJwtGuard, RolesGuard)
@Roles(RoleEnum.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('organizations')
  createOrganization(@Body() body: CreateOrganizationDTO): Promise<ProvisionResult> {
    return this.platformService.createOrganization(body);
  }
}
