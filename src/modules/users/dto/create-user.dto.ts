import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDTO {
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

  // Organization member role for the new employee: ADMIN -> 'admin', USER -> 'member' (default).
  @IsOptional()
  @IsIn(['ADMIN', 'USER'])
  role?: 'ADMIN' | 'USER';
}
