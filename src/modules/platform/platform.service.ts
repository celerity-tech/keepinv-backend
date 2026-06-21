import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';

import { authPrisma } from '../../core/auth/auth.client';
import { createCredentialUser, OrgRole, provisionOrganizationUser } from '../../core/auth/provisioning';
import type { SafeUser } from '../users/types/users.types';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { CreateOrgUserDTO } from './dto/create-org-user.dto';

export interface ProvisionResult {
  organization: Organization;
  admin: SafeUser;
}

@Injectable()
export class PlatformService {
  // Manual tenant provisioning. SUPER_ADMIN-only (enforced at the controller). Creates the
  // organization and its first owner — a Better Auth credential user + an 'owner' membership —
  // atomically on the identity tables (which are excluded from tenant RLS).
  async createOrganization(body: CreateOrganizationDTO): Promise<ProvisionResult> {
    const slug = body.slug ?? this.slugify(body.name);

    try {
      return await authPrisma.$transaction(async (tx) => {
        const slugTaken = await tx.organization.findUnique({ where: { slug } });
        if (slugTaken) throw new ConflictException('Organization slug already in use');

        const organization = await tx.organization.create({ data: { name: body.name, slug } });
        const admin = await createCredentialUser(tx, body.admin);
        await tx.member.create({
          data: { organizationId: organization.id, userId: admin.id, role: 'owner' },
        });

        return { organization, admin };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or slug already in use');
      }
      throw error;
    }
  }

  // Adds an account to an existing tenant on request. SUPER_ADMIN-only at the controller.
  // role maps to the organization member role: ADMIN -> 'admin', USER (default) -> 'member'.
  async createOrganizationUser(organizationId: string, body: CreateOrgUserDTO): Promise<SafeUser> {
    const organization = await authPrisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');

    const role: OrgRole = body.role === 'ADMIN' ? 'admin' : 'member';
    return provisionOrganizationUser(organizationId, body, role);
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
