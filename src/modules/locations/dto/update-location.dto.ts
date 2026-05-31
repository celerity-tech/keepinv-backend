import { PartialType } from '@nestjs/mapped-types';
import { CreateLocationDTO } from './create-location.dto';

export class UpdateLocationDTO extends PartialType(CreateLocationDTO) {}
