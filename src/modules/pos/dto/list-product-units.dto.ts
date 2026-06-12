import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListProductUnitsDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 50;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  sellableOnly: boolean = true;
}
