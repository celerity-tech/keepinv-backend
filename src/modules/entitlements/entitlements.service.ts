import { Injectable } from '@nestjs/common';
import { OrgPlan, PrinterType } from '@prisma/client';

import { authPrisma } from '../../core/auth/auth.client';

// TODO(enforcement): gating is currently frontend-only. If this build is ever exposed to untrusted
// users, add a `@RequireFeature('pos')` guard on PosController so BASIC orgs can't call POS
// endpoints. It can reuse EntitlementsService.resolve(activeOrganizationId).

// Plan-driven capabilities the frontend gates UI on. The plan selects MODULES:
//   BASIC = Inventory only.   PRO = POS + Inventory.
// RFID and barcode are available on both plans; label printing depends only on the tenant's
// configured printer (printerType), not the plan.
export interface EntitlementFeatures {
  inventory: boolean; // baseline, always available
  pos: boolean; // PRO only
  rfid: boolean; // both plans
  labelPrinting: boolean; // printerType != NONE
}

export interface Entitlements {
  plan: OrgPlan;
  printerType: PrinterType;
  features: EntitlementFeatures;
}

@Injectable()
export class EntitlementsService {
  // Resolves the entitlements for an active organization. The organization row lives on the
  // identity tables (excluded from tenant RLS) and we filter strictly by the caller's own active
  // org id, so reading via authPrisma cannot leak across tenants. A null org (the platform
  // operator, or a membership-less account) gets full access.
  async resolve(organizationId: string | null): Promise<Entitlements> {
    // The platform operator (super-admin) has no active organization. Plans live on the org, not
    // the user, so the operator gets full access (PRO, all modules).
    if (!organizationId) {
      return {
        plan: 'PRO',
        printerType: 'NONE',
        features: { inventory: true, pos: true, rfid: true, labelPrinting: false },
      };
    }

    const org = await authPrisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, printerType: true },
    });

    const plan = org?.plan ?? 'BASIC';
    const printerType = org?.printerType ?? 'NONE';

    return {
      plan,
      printerType,
      features: {
        inventory: true,
        pos: plan === 'PRO',
        rfid: true,
        labelPrinting: printerType !== 'NONE',
      },
    };
  }
}
