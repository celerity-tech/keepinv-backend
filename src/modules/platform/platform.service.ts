import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, Prisma, RoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../core/database/prisma.service';
import type { SafeUser } from '../users/types/users.types';
import { CreateOrganizationDTO } from './dto/create-organization.dto';
import { CreateOrgUserDTO } from './dto/create-org-user.dto';

const BCRYPT_ROUNDS = 10;

export interface ProvisionResult {
  organization: Organization;
  admin: SafeUser;
}

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  // Manual tenant provisioning. SUPER_ADMIN-only (enforced at the controller). Creates the
  // organization and its first ADMIN atomically, escaping RLS via a system-bypass context.
  async createOrganization(body: CreateOrganizationDTO): Promise<ProvisionResult> {
    const slug = body.slug ?? this.slugify(body.name);
    const email = body.admin.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(body.admin.password, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx, { systemBypass: true });

      const slugTaken = await tx.organization.findUnique({ where: { slug } });
      if (slugTaken) throw new ConflictException('Organization slug already in use');

      const emailTaken = await tx.user.findUnique({ where: { email } });
      if (emailTaken) throw new ConflictException('Email already in use');

      const organization = await tx.organization.create({
        data: { name: body.name, slug },
      });

      const admin = await tx.user.create({
        data: {
          firstName: body.admin.firstName,
          lastName: body.admin.lastName,
          email,
          password: passwordHash,
          role: RoleEnum.ADMIN,
          organizationId: organization.id,
        },
        omit: { password: true },
      });

      return { organization, admin };
    });
  }

  // Adds an ADMIN/USER account to an existing tenant on request. SUPER_ADMIN-only at the
  // controller; the new user is bound to the target organization via system-bypass.
  async createOrganizationUser(organizationId: string, body: CreateOrgUserDTO): Promise<SafeUser> {
    const email = body.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      await this.prisma.setTenantContext(tx, { systemBypass: true });

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw new NotFoundException('Organization not found');

      try {
        return await tx.user.create({
          data: {
            firstName: body.firstName,
            lastName: body.lastName,
            email,
            password: passwordHash,
            role: body.role ?? RoleEnum.USER,
            organizationId,
          },
          omit: { password: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
        throw error;
      }
    });
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
