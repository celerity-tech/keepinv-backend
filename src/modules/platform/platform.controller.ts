import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { Organization } from '@prisma/client';
import { Roles } from '@thallesp/nestjs-better-auth';

import type { SafeUser } from '../users/types/users.types';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { CreateOrgUserDTO } from './dto/create-org-user.dto';
import { UpdateOrganizationDTO } from './dto/update-organization.dto';
import { PlatformService, ProvisionResult } from './platform.service';

// Operator-only endpoints for manual tenant provisioning (no public/self-service signup).
// @Roles(['admin']) checks the Better Auth admin-plugin system role on user.role — i.e. the
// platform SUPER_ADMIN (only the operator). Organization member roles cannot reach these routes.
@Controller('platform')
@Roles(['admin'])
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('organizations')
  createOrganization(@Body() body: CreateOrganizationDTO): Promise<ProvisionResult> {
    return this.platformService.createOrganization(body);
  }

  // Update an existing tenant's plan / printer / trial / active flag.
  @Patch('organizations/:orgId')
  updateOrganization(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: UpdateOrganizationDTO,
  ): Promise<Organization> {
    return this.platformService.updateOrganization(orgId, body);
  }

  // Add an org admin/member account to an existing tenant on request.
  @Post('organizations/:orgId/users')
  createOrganizationUser(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: CreateOrgUserDTO,
  ): Promise<SafeUser> {
    return this.platformService.createOrganizationUser(orgId, body);
  }
}
