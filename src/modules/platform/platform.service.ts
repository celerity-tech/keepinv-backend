import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';

import { authPrisma } from '../../core/auth/auth.client';
import { createCredentialUser, OrgRole, provisionOrganizationUser } from '../../core/auth/provisioning';
import type { SafeUser } from '../users/types/users.types';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { CreateOrgUserDTO } from './dto/create-org-user.dto';
import { UpdateOrganizationDTO } from './dto/update-organization.dto';

export interface ProvisionResult {
  organization: Organization;
  admin: SafeUser;
}

const DEFAULT_TRIAL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformService {
  // Manual tenant provisioning. SUPER_ADMIN-only (enforced at the controller). Creates the
  // organization and its first owner — a Better Auth credential user + an 'owner' membership —
  // atomically on the identity tables (which are excluded from tenant RLS).
  async createOrganization(body: CreateOrganizationDTO): Promise<ProvisionResult> {
    const slug = body.slug ?? this.slugify(body.name);
    const trialDays = body.trialDays ?? DEFAULT_TRIAL_DAYS;
    const trialEndsAt =
      trialDays > 0 ? new Date(Date.now() + trialDays * MS_PER_DAY) : null;

    try {
      return await authPrisma.$transaction(async (tx) => {
        const slugTaken = await tx.organization.findUnique({ where: { slug } });
        if (slugTaken) throw new ConflictException('Organization slug already in use');

        const organization = await tx.organization.create({
          data: {
            name: body.name,
            slug,
            plan: body.plan ?? 'BASIC',
            printerType: body.printerType ?? 'NONE',
            trialEndsAt,
          },
        });
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

  // Lists every tenant. SUPER_ADMIN-only at the controller. Runs on the plain Better Auth client
  // (organization is an identity table, excluded from tenant RLS), so it returns all orgs.
  async listOrganizations(): Promise<Organization[]> {
    return authPrisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Updates a tenant's plan / printer / trial / active flag. SUPER_ADMIN-only at the controller.
  // Only the provided fields change; trialDays (when sent) recomputes trialEndsAt — 0 clears it
  // (marks the org subscribed), > 0 starts/extends a trial that many days from now.
  async updateOrganization(
    organizationId: string,
    body: UpdateOrganizationDTO,
  ): Promise<Organization> {
    const organization = await authPrisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');

    const data: Prisma.OrganizationUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.plan !== undefined) data.plan = body.plan;
    if (body.printerType !== undefined) data.printerType = body.printerType;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    // Explicit timestamp wins; otherwise derive from trialDays (0 clears = subscribed).
    if (body.trialEndsAt !== undefined) {
      data.trialEndsAt = body.trialEndsAt === null ? null : new Date(body.trialEndsAt);
    } else if (body.trialDays !== undefined) {
      data.trialEndsAt = body.trialDays > 0 ? new Date(Date.now() + body.trialDays * MS_PER_DAY) : null;
    }

    return authPrisma.organization.update({ where: { id: organizationId }, data });
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
