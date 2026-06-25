import { OrgPlan, PrinterType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Operator-only changes to an existing tenant: rename, or upgrade/downgrade the plan, switch
// printer. All fields optional — only what is sent is changed.
export class UpdateOrganizationDTO {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  // BASIC = Inventory only; PRO = POS + Inventory.
  @IsOptional()
  @IsEnum(OrgPlan)
  plan?: OrgPlan;

  @IsOptional()
  @IsEnum(PrinterType)
  printerType?: PrinterType;
}
