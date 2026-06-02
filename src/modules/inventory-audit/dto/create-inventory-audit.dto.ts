import { IsUUID } from 'class-validator';

import { AddInventoryAuditScansDTO } from './add-inventory-audit-scans.dto';

export class CreateInventoryAuditDTO extends AddInventoryAuditScansDTO {
  @IsUUID()
  locationId!: string;
}
