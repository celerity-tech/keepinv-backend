import { Injectable } from '@nestjs/common';
import { OrgPlan, PrinterType } from '@prisma/client';

import { authPrisma } from '../../core/auth/auth.client';

// TODO(enforcement): gating is currently frontend-only. Before onboarding public tenants, enforce
// on the API too:
//   1. A `@RequireFeature('pos')` guard on PosController so BASIC orgs can't call POS endpoints.
//   2. A trial-lock guard on tenant routes that 403s when `locked` (expired trial / inactive org).
// Both can reuse EntitlementsService.resolve(activeOrganizationId).

// Plan-driven capabilities the frontend gates UI on. The plan now selects MODULES:
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
  trialEndsAt: Date | null;
  trialActive: boolean; // a trial is set and still running
  trialExpired: boolean; // a trial is set and has elapsed
  locked: boolean; // access blocked (expired trial or deactivated org)
  features: EntitlementFeatures;
}

@Injectable()
export class EntitlementsService {
  // Resolves the entitlements for an active organization. The organization row lives on the
  // identity tables (excluded from tenant RLS) and we filter strictly by the caller's own active
  // org id, so reading via authPrisma cannot leak across tenants. A null org (the platform
  // operator, or a membership-less account) is never locked and gets BASIC defaults.
  async resolve(organizationId: string | null): Promise<Entitlements> {
    // The platform operator (super-admin) has no active organization. Plans live on the org, not
    // the user, so the operator gets full access (PRO, all modules) and is never locked.
    if (!organizationId) {
      return {
        plan: 'PRO',
        printerType: 'NONE',
        trialEndsAt: null,
        trialActive: false,
        trialExpired: false,
        locked: false,
        features: { inventory: true, pos: true, rfid: true, labelPrinting: false },
      };
    }

    const org = await authPrisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, printerType: true, trialEndsAt: true, isActive: true },
    });

    const plan = org?.plan ?? 'BASIC';
    const printerType = org?.printerType ?? 'NONE';
    const trialEndsAt = org?.trialEndsAt ?? null;
    const isActive = org?.isActive ?? true;

    const now = Date.now();
    const trialActive = trialEndsAt !== null && trialEndsAt.getTime() > now;
    const trialExpired = trialEndsAt !== null && trialEndsAt.getTime() <= now;
    // Locked when the trial has elapsed or the operator deactivated the org.
    const locked = trialExpired || !isActive;

    return {
      plan,
      printerType,
      trialEndsAt,
      trialActive,
      trialExpired,
      locked,
      features: {
        inventory: true,
        pos: plan === 'PRO',
        rfid: true,
        labelPrinting: printerType !== 'NONE',
      },
    };
  }
}
