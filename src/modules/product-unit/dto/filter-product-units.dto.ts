import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductUnitStatus } from '@prisma/client';

import { PaginationQueryDTO } from '../../../common/dto/pagination-query.dto';

const trimOptional = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class FilterProductUnitsDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(ProductUnitStatus)
  status?: ProductUnitStatus;

  /** When true, only units with no RFID tag are returned (the "assets without RFID" report drill-down). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  untagged?: boolean;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  search?: string;
}
