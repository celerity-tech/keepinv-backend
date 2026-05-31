import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDTO {
  @IsUUID()
  productId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  // Sign/zero rules are enforced in the service (ADJUSTMENT may be negative), so no @Min here.
  @IsInt()
  quantity!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
