import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { SupplierPlatform } from '@prisma/client';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSupplierLinkDTO {
  @IsEnum(SupplierPlatform)
  platform!: SupplierPlatform;

  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  label?: string;
}
