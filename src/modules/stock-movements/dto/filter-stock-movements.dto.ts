import { IsDateString, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDTO } from '../../../common/dto/pagination-query.dto';

export class FilterStockMovementsDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  productUnitId?: string;

  @IsOptional()
  @IsUUID()
  stockMovementTypeId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
