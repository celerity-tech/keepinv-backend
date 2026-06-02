import { IsUUID } from 'class-validator';

export class ExpectedAssetsQueryDTO {
  @IsUUID()
  locationId!: string;
}
