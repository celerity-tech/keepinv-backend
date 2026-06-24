import { OrgPlan, PrinterType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Operator-only changes to an existing tenant: upgrade/downgrade the plan, switch printer,
// activate/deactivate, or adjust the trial. All fields optional — only what is sent is changed.
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

  // Soft enable/disable the whole tenant. false locks every member out (same lock screen as an
  // expired trial).
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Reset the trial window: > 0 starts/extends a trial that many days from now; 0 clears the trial
  // entirely, i.e. marks the org as subscribed (never locked by trial). Omit to leave it unchanged.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  // Explicit trial end timestamp (ISO 8601), or null to clear it. Takes precedence over trialDays.
  // Useful for testing: set a PAST date to simulate an expired trial. e.g. "2020-01-01T00:00:00.000Z".
  @IsOptional()
  @ValidateIf((dto: UpdateOrganizationDTO) => dto.trialEndsAt !== null)
  @IsDateString()
  trialEndsAt?: string | null;
}
