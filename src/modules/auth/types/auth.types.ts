import type { RoleEnum, User } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  role: RoleEnum;
  organizationId: string | null;
};

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'role' | 'organizationId'>;

export type LoginUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'organizationId'>;

export type AuthResult = LoginUser & {
  accessToken: string;
};
