import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PassportJwtGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ReceiptImportDTO } from './dto/receipt-import.dto';
import { ReceiptImportsService } from './receipt-imports.service';

@Controller('receipt-imports')
@UseGuards(PassportJwtGuard, RolesGuard)
export class ReceiptImportsController {
  constructor(private readonly receiptImportsService: ReceiptImportsService) {}

  @Post('preview')
  @HttpCode(200)
  async previewReceiptImport(@Body() body: ReceiptImportDTO) {
    return this.receiptImportsService.previewReceiptImport(body);
  }

  @Post('commit')
  @Roles(RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN)
  async commitReceiptImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReceiptImportDTO,
  ) {
    return this.receiptImportsService.commitReceiptImport(user.id, body);
  }
}
