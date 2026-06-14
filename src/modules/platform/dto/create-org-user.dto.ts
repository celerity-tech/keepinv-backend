import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleEnum } from '@prisma/client';

// Operator-created account for an existing tenant. SUPER_ADMIN cannot be assigned here —
// platform operators are created out-of-band, never bound to a tenant.
export class CreateOrgUserDTO {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn([RoleEnum.ADMIN, RoleEnum.USER])
  role?: RoleEnum;
}
