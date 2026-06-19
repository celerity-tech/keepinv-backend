import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ReceiptImportDTO } from './dto/receipt-import.dto';
import { ReceiptImportsService } from './receipt-imports.service';

@Controller('receipt-imports')
@UseGuards(PassportJwtGuard)
export class ReceiptImportsController {
  constructor(private readonly receiptImportsService: ReceiptImportsService) {}

  @Post('preview')
  async previewReceiptImport(@Body() body: ReceiptImportDTO) {
    return this.receiptImportsService.previewReceiptImport(body);
  }

  @Post('commit')
  async commitReceiptImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReceiptImportDTO,
  ) {
    return this.receiptImportsService.commitReceiptImport(user.id, body);
  }
}
