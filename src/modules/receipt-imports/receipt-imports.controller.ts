import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { OrgRoles, Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { ReceiptImportDTO } from './dto/receipt-import.dto';
import {
  ReceiptImportCommit,
  ReceiptImportPreview,
  ReceiptImportsService,
} from './receipt-imports.service';

// Receipt imports read and write the tenant's catalog and stock, so both endpoints are org-admin only.
@Controller('receipt-imports')
@OrgRoles(['owner', 'admin'])
export class ReceiptImportsController {
  constructor(private readonly receiptImportsService: ReceiptImportsService) {}

  @Post('preview')
  @HttpCode(200)
  async previewReceiptImport(@Body() body: ReceiptImportDTO): Promise<ReceiptImportPreview> {
    return this.receiptImportsService.previewReceiptImport(body);
  }

  @Post('commit')
  async commitReceiptImport(
    @Session() session: UserSession,
    @Body() body: ReceiptImportDTO,
  ): Promise<ReceiptImportCommit> {
    return this.receiptImportsService.commitReceiptImport(session.user.id, body);
  }
}
