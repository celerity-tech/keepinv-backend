import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { StockMovementEffect } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStockMovementTypeDTO {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsEnum(StockMovementEffect)
  effect!: StockMovementEffect;
}
