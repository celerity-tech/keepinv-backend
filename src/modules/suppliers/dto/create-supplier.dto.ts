import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSupplierDTO {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  contactName?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
