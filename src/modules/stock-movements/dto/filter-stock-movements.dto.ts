import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StockMovementType } from '@prisma/client';

import { PaginationQueryDTO } from '../../../common/dto/pagination-query.dto';

export class FilterStockMovementsDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
