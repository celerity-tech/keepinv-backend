import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierLinkDTO } from './create-supplier-link.dto';

export class UpdateSupplierLinkDTO extends PartialType(CreateSupplierLinkDTO) {}
