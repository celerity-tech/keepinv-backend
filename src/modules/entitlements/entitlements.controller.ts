import { Controller, Get, Req } from '@nestjs/common';

import { Entitlements, EntitlementsService } from './entitlements.service';

// Shape attached to the request by @thallesp/nestjs-better-auth's global AuthGuard.
interface RequestWithSession {
  session?: { session?: { activeOrganizationId?: string | null } } | null;
}

// Tenant-facing: the signed-in user's plan entitlements for the active organization. The frontend
// reads this at startup to gate features (RFID, label printing). Auth is enforced globally by the
// Better Auth guard, so an unauthenticated request never reaches here.
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  resolve(@Req() request: RequestWithSession): Promise<Entitlements> {
    const organizationId = request.session?.session?.activeOrganizationId ?? null;
    return this.entitlements.resolve(organizationId);
  }
}
