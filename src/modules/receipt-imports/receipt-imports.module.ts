import { Module } from '@nestjs/common';

import { ReceiptImportsController } from './receipt-imports.controller';
import { ReceiptImportsService } from './receipt-imports.service';

@Module({
  controllers: [ReceiptImportsController],
  providers: [ReceiptImportsService],
})
export class ReceiptImportsModule {}
