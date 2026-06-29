import { PartialType } from '@nestjs/mapped-types';
import { CreateStockMovementTypeDTO } from './create-stock-movement-type.dto';

export class UpdateStockMovementTypeDTO extends PartialType(CreateStockMovementTypeDTO) {}
