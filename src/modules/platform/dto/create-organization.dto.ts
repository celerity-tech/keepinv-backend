import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Initial owner account handed to the client on purchase.
export class ProvisionAdminDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class CreateOrganizationDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  // Optional URL-safe identifier; derived from the name when omitted.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric words separated by single hyphens',
  })
  slug?: string;

  @ValidateNested()
  @Type(() => ProvisionAdminDTO)
  admin!: ProvisionAdminDTO;
}
