import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { OrgRoles, Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { CreateUserDTO } from './dto/create-user.dto';
import { UsersService } from './users.service';
import type { SafeUser } from './types/users.types';

// All routes require an org owner/admin acting on their active organization. SUPER_ADMIN
// provisions tenants via POST /platform/organizations instead.
@Controller('users')
@OrgRoles(['owner', 'admin'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createUser(@Session() session: UserSession, @Body() body: CreateUserDTO): Promise<SafeUser> {
    return this.usersService.createUser(this.activeOrg(session), body);
  }

  @Get()
  getAllUsers(@Session() session: UserSession): Promise<SafeUser[]> {
    return this.usersService.getOrganizationUsers(this.activeOrg(session));
  }

  @Get(':id')
  async findUserById(
    @Session() session: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SafeUser> {
    const user = await this.usersService.findOrganizationUser(this.activeOrg(session), id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private activeOrg(session: UserSession): string {
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) throw new ForbiddenException('No active organization selected');
    return organizationId;
  }
}
