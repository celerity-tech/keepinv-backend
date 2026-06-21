import { Injectable } from '@nestjs/common';

import { authPrisma } from '../../core/auth/auth.client';
import { OrgRole, provisionOrganizationUser } from '../../core/auth/provisioning';
import { CreateUserDTO } from './dto/create-user.dto';
import type { SafeUser } from './types/users.types';

// Tenant-scoped user management. All reads/writes are explicitly bound to the caller's active
// organization (identity tables are not under tenant RLS, so scoping is enforced here via the
// `members` join). Cross-tenant provisioning is the platform module's job.
@Injectable()
export class UsersService {
  // Onboard an employee into the caller's active organization (Better Auth credential user +
  // membership). role: ADMIN -> 'admin', USER/default -> 'member'.
  async createUser(organizationId: string, dto: CreateUserDTO): Promise<SafeUser> {
    const role: OrgRole = dto.role === 'ADMIN' ? 'admin' : 'member';
    return provisionOrganizationUser(organizationId, dto, role);
  }

  // Members of the active organization, as their (password-free) user records.
  async getOrganizationUsers(organizationId: string): Promise<SafeUser[]> {
    const members = await authPrisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: { user: { omit: { password: true } } },
    });
    return members.map((member) => member.user);
  }

  // A single user, but only if they belong to the active organization.
  async findOrganizationUser(organizationId: string, userId: string): Promise<SafeUser | null> {
    const member = await authPrisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { user: { omit: { password: true } } },
    });
    return member?.user ?? null;
  }
}
