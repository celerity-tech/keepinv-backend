import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { OrgRoles, Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { ReceiptImportDTO } from './dto/receipt-import.dto';
import { ReceiptImportsService } from './receipt-imports.service';

@Controller('receipt-imports')
export class ReceiptImportsController {
  constructor(private readonly receiptImportsService: ReceiptImportsService) {}

  @Post('preview')
  @HttpCode(200)
  async previewReceiptImport(@Body() body: ReceiptImportDTO) {
    return this.receiptImportsService.previewReceiptImport(body);
  }

  // Committing an import writes into the tenant's inventory, so it's restricted to org admins.
  @Post('commit')
  @OrgRoles(['owner', 'admin'])
  async commitReceiptImport(
    @Session() session: UserSession,
    @Body() body: ReceiptImportDTO,
  ) {
    return this.receiptImportsService.commitReceiptImport(session.user.id, body);
  }
}
