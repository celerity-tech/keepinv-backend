import { StockMovementEffect } from '@prisma/client';

export const STOCK_MOVEMENT_SYSTEM_KEY = {
  INITIAL: 'INITIAL',
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
  RETURN: 'RETURN',
} as const;

export type StockMovementSystemKey =
  (typeof STOCK_MOVEMENT_SYSTEM_KEY)[keyof typeof STOCK_MOVEMENT_SYSTEM_KEY];

export const DEFAULT_STOCK_MOVEMENT_TYPES = [
  {
    name: 'Initial Stock',
    description: 'Opening inventory entered when a product or unit is first registered',
    effect: StockMovementEffect.INCREASE,
    systemKey: STOCK_MOVEMENT_SYSTEM_KEY.INITIAL,
    isArchived: false,
  },
  {
    name: 'Purchase',
    description: 'Inventory received from a supplier',
    effect: StockMovementEffect.INCREASE,
    systemKey: STOCK_MOVEMENT_SYSTEM_KEY.PURCHASE,
    isArchived: false,
  },
  {
    name: 'Sale',
    description: 'Inventory issued through a completed sale',
    effect: StockMovementEffect.DECREASE,
    systemKey: STOCK_MOVEMENT_SYSTEM_KEY.SALE,
    isArchived: false,
  },
  {
    name: 'Adjustment',
    description: 'A signed inventory correction after a count or reconciliation',
    effect: StockMovementEffect.ADJUSTMENT,
    systemKey: STOCK_MOVEMENT_SYSTEM_KEY.ADJUSTMENT,
    isArchived: false,
  },
  {
    name: 'Return',
    description: 'Inventory returned to available stock',
    effect: StockMovementEffect.INCREASE,
    systemKey: STOCK_MOVEMENT_SYSTEM_KEY.RETURN,
    isArchived: false,
  },
] as const;
