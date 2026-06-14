import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { RoleEnum } from '@prisma/client';

import { TENANT_CLS_KEY, TenantContext } from './tenant.types';

// Populates the per-request tenant context in CLS from the authenticated user. Runs after
// the auth guards (which set request.user), so every downstream Prisma query is scoped.
// SUPER_ADMIN operators are cross-tenant, so they bypass RLS. Unauthenticated routes
// (e.g. login) leave the context empty; those paths opt into bypass explicitly.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string; role: RoleEnum; organizationId?: string | null } }>();
    const user = request?.user;

    if (user) {
      const tenant: TenantContext = {
        userId: user.id,
        role: user.role,
        organizationId: user.organizationId ?? null,
        systemBypass: user.role === RoleEnum.SUPER_ADMIN,
      };
      this.cls.set(TENANT_CLS_KEY, tenant);
    }

    return next.handle();
  }
}
