import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MIN_CONFIDENCE = 0.9;

class ReceiptSupplierDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

class ReceiptDetailsDTO {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiptNumber?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;
}

class ReceiptImportDefaultsDTO {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  sellingPriceMarkupPercent?: number;
}

class ReceiptItemConfidenceDTO {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  productName!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  unitCost!: number;
}

class ReceiptImportItemDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  rawName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  normalizedName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lineTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice?: number;

  @ValidateNested()
  @Type(() => ReceiptItemConfidenceDTO)
  confidence!: ReceiptItemConfidenceDTO;
}

class ReceiptImportSourceDTO {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  processedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ReceiptImportDTO {
  @ValidateNested()
  @Type(() => ReceiptSupplierDTO)
  supplier!: ReceiptSupplierDTO;

  @ValidateNested()
  @Type(() => ReceiptDetailsDTO)
  receipt!: ReceiptDetailsDTO;

  @ValidateNested()
  @Type(() => ReceiptImportDefaultsDTO)
  defaults!: ReceiptImportDefaultsDTO;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptImportItemDTO)
  items!: ReceiptImportItemDTO[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ReceiptImportSourceDTO)
  source?: ReceiptImportSourceDTO;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export { MIN_CONFIDENCE, ReceiptImportItemDTO };
