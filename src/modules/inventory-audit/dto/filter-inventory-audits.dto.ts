import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InventoryAuditStatus } from '@prisma/client';

import { PaginationQueryDTO } from '../../../common/dto/pagination-query.dto';

export class FilterInventoryAuditsDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(InventoryAuditStatus)
  status?: InventoryAuditStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
