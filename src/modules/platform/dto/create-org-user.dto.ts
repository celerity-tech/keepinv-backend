import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Operator-created account for an existing tenant. `role` maps to the organization member role:
// ADMIN -> org 'admin', USER -> org 'member'. Platform SUPER_ADMIN is never assigned here.
export class CreateOrgUserDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'USER'])
  role?: 'ADMIN' | 'USER';
}
