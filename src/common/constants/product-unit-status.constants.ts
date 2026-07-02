import { ProductUnitStatus } from '@prisma/client';

// Single source of truth for what each product-unit status *means* operationally. Shared by the
// product-unit, POS, inventory-audit, and reports modules so the rules never drift between them.

/**
 * Statuses whose units still count toward `Product.quantityOnHand`. MISPLACED counts: the unit is
 * physically present, just in the wrong location. Crossing this boundary on a status change is what
 * drives the on-hand +/-1 delta (see `resolveStatusQuantityDelta`).
 */
export const STOCK_COUNTED_STATUSES: ReadonlySet<ProductUnitStatus> = new Set([
  ProductUnitStatus.IN_STOCK,
  ProductUnitStatus.RESERVED,
  ProductUnitStatus.RETURNED,
  ProductUnitStatus.MISPLACED,
]);

/** Terminal statuses that clear a unit's location (it is no longer anywhere on the shelf). */
export const LOCATION_CLEARED_STATUSES: ReadonlySet<ProductUnitStatus> = new Set([
  ProductUnitStatus.SOLD,
  ProductUnitStatus.LOST,
  ProductUnitStatus.DISPOSED,
]);

/** Statuses on which RFID/asset-tag writes are refused (sold, lost, or written off). */
export const TAG_WRITE_BLOCKED_STATUSES: ReadonlySet<ProductUnitStatus> = new Set([
  ProductUnitStatus.SOLD,
  ProductUnitStatus.LOST,
  ProductUnitStatus.DISPOSED,
]);

/**
 * Statuses a POS sale may draw from. MISPLACED is sellable: the unit exists and selling it cleanly
 * resolves the discrepancy, rather than advertising on-hand stock the till refuses to move.
 */
export const SELLABLE_UNIT_STATUSES: ReadonlySet<ProductUnitStatus> = new Set([
  ProductUnitStatus.IN_STOCK,
  ProductUnitStatus.RESERVED,
  ProductUnitStatus.RETURNED,
  ProductUnitStatus.MISPLACED,
]);

/**
 * The only statuses an inventory audit is allowed to reconcile. SOLD/RESERVED/DAMAGED/LOST/DISPOSED
 * are owned by other workflows and must never be flipped by completing a count.
 */
export const AUDIT_MANAGED_STATUSES: ReadonlySet<ProductUnitStatus> = new Set([
  ProductUnitStatus.IN_STOCK,
  ProductUnitStatus.MISSING,
  ProductUnitStatus.MISPLACED,
]);

/**
 * Hidden from the default product-unit listing: terminal states nobody manages day to day. MISSING
 * and MISPLACED stay visible on purpose — they are active problems to chase down.
 */
export const DEFAULT_HIDDEN_UNIT_STATUSES: readonly ProductUnitStatus[] = [
  ProductUnitStatus.SOLD,
  ProductUnitStatus.LOST,
  ProductUnitStatus.DISPOSED,
];
