import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';

import { authPrisma } from '../../core/auth/auth.client';
import { createCredentialUser, OrgRole, provisionOrganizationUser } from '../../core/auth/provisioning';
import { CloudinaryService } from '../../core/cloudinary/cloudinary.service';
import { PG_BYPASS_SETTING } from '../../core/tenant/tenant.types';
import type { SafeUser } from '../users/types/users.types';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { CreateOrgUserDTO } from './dto/create-org-user.dto';
import { UpdateOrganizationDTO } from './dto/update-organization.dto';
import { DEFAULT_STOCK_MOVEMENT_TYPES } from '../stock-movement-types/constants/stock-movement-type.constants';

export interface ProvisionResult {
  organization: Organization;
  admin: SafeUser;
}

export interface DeleteOrganizationResult {
  id: string;
  name: string;
  deletedUsers: number;
}

const DEFAULT_TRIAL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformService {
  constructor(private readonly cloudinary: CloudinaryService) {}

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
        await tx.$executeRaw`SELECT set_config(${PG_BYPASS_SETTING}, 'on', true)`;

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
        await tx.stockMovementType.createMany({
          data: DEFAULT_STOCK_MOVEMENT_TYPES.map((movementType) => ({
            ...movementType,
            organizationId: organization.id,
          })),
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

  // Permanently wipes a tenant: every business row, its org-exclusive user accounts, the org
  // itself, and its hosted product images. SUPER_ADMIN-only at the controller. IRREVERSIBLE — no
  // soft-delete, no grace period. The DB work runs in one transaction so it is all-or-nothing.
  async deleteOrganization(organizationId: string): Promise<DeleteOrganizationResult> {
    const organization = await authPrisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');

    // Business tables are FORCE-RLS and authPrisma sets no tenant GUC, so without bypass these
    // deletes would match zero rows. set_config(..., true) enables bypass for THIS transaction only.
    const deletedUsers = await authPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config(${PG_BYPASS_SETTING}, 'on', true)`;

      // Children before parents so no RESTRICT foreign key blocks the delete.
      await tx.inventoryAuditScan.deleteMany({ where: { organizationId } });
      await tx.inventoryAudit.deleteMany({ where: { organizationId } });
      await tx.stockMovement.deleteMany({ where: { organizationId } });
      await tx.stockMovementType.deleteMany({ where: { organizationId } });
      await tx.saleItem.deleteMany({ where: { organizationId } });
      await tx.sale.deleteMany({ where: { organizationId } });
      await tx.productUnit.deleteMany({ where: { organizationId } });
      await tx.product.deleteMany({ where: { organizationId } });
      await tx.supplierLink.deleteMany({ where: { organizationId } });
      await tx.supplier.deleteMany({ where: { organizationId } });
      await tx.location.deleteMany({ where: { organizationId } });
      await tx.category.deleteMany({ where: { organizationId } });

      // Users tied to this org via membership or the legacy users.organizationId column.
      const [members, legacyUsers] = await Promise.all([
        tx.member.findMany({ where: { organizationId }, select: { userId: true } }),
        tx.user.findMany({ where: { organizationId }, select: { id: true } }),
      ]);
      const candidateIds = [
        ...new Set([...members.map((m) => m.userId), ...legacyUsers.map((u) => u.id)]),
      ];

      // A candidate shared with another org (member elsewhere, or legacy column points elsewhere)
      // is kept; only org-exclusive accounts are deleted.
      const sharedIds = new Set<string>();
      if (candidateIds.length > 0) {
        const [otherMembers, otherLegacy] = await Promise.all([
          tx.member.findMany({
            where: { userId: { in: candidateIds }, organizationId: { not: organizationId } },
            select: { userId: true },
          }),
          tx.user.findMany({
            where: { id: { in: candidateIds }, organizationId: { not: organizationId } },
            select: { id: true },
          }),
        ]);
        otherMembers.forEach((m) => sharedIds.add(m.userId));
        otherLegacy.forEach((u) => sharedIds.add(u.id));
      }
      const userIdsToDelete = candidateIds.filter((id) => !sharedIds.has(id));

      // Kept users still pointing here via the legacy RESTRICT column would block the org delete —
      // sever that link first.
      await tx.user.updateMany({
        where: { organizationId, id: { notIn: userIdsToDelete } },
        data: { organizationId: null },
      });

      // Deleting a user cascades its accounts, sessions, memberships and sent invitations.
      if (userIdsToDelete.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIdsToDelete } } });
      }

      // Any remaining (shared) users' membership in this org cascades with the org delete.
      await tx.organization.delete({ where: { id: organizationId } });

      return userIdsToDelete.length;
    });

    // External assets are purged AFTER the DB commit so a Cloudinary failure can't roll back the wipe.
    await this.cloudinary.destroyProductImages(organizationId);

    return { id: organization.id, name: organization.name, deletedUsers };
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
