import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InventoryAuditScanMode } from '@prisma/client';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimStringArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class AddInventoryAuditScansDTO {
  @IsOptional()
  @Transform(trimStringArray)
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  tags?: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20000)
  rawInput?: string;

  @IsOptional()
  @IsEnum(InventoryAuditScanMode)
  scanMode?: InventoryAuditScanMode;
}
