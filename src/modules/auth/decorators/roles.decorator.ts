import { SetMetadata } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Restricts a route to the listed roles. Must be combined with PassportJwtGuard + RolesGuard.
export const Roles = (...roles: RoleEnum[]) => SetMetadata(ROLES_KEY, roles);
