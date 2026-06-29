import { Module } from '@nestjs/common';
import { StockMovementTypesService } from './stock-movement-types.service';
import { StockMovementTypesController } from './stock-movement-types.controller';

@Module({
  controllers: [StockMovementTypesController],
  providers: [StockMovementTypesService],
  exports: [StockMovementTypesService],
})
export class StockMovementTypesModule {}
