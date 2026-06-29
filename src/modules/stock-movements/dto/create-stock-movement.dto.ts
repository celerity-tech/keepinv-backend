import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStockMovementDTO {
  @IsUUID()
  productId!: string;

  @IsUUID()
  stockMovementTypeId!: string;

  // Sign/zero rules depend on the selected type's effect, so they are enforced in the service.
  @IsInt()
  quantity!: number;

  @IsOptional()
  @Transform(trim)
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
