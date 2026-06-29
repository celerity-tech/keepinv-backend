import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { StockMovementSystemKey } from '../constants/stock-movement-type.constants';

type StockMovementTypeReader = Pick<Prisma.TransactionClient, 'stockMovementType'>;

export async function getSystemStockMovementTypeId(
  client: StockMovementTypeReader,
  systemKey: StockMovementSystemKey,
): Promise<string> {
  const movementType = await client.stockMovementType.findFirst({
    where: { systemKey, isArchived: false },
    select: { id: true },
  });

  if (!movementType) {
    throw new NotFoundException(`Required ${systemKey} stock movement type not found`);
  }

  return movementType.id;
}
