import { authPrisma } from './auth.client';

// Default the session's active organization to the user's first membership. Business routes are
// RLS-scoped by session.activeOrganizationId, so this lets a user hit tenant data immediately
// after login without a separate "set active organization" call. Platform SUPER_ADMIN (no
// membership) gets null and operates only through the explicit platform-admin routes.
export const sessionHooks = {
  create: {
    before: async (session: { userId: string; activeOrganizationId?: string | null }) => {
      if (session.activeOrganizationId) return { data: session };

      const member = await authPrisma.member.findFirst({
        where: { userId: session.userId },
        orderBy: { createdAt: 'asc' },
        select: { organizationId: true },
      });

      return {
        data: {
          ...session,
          activeOrganizationId: member?.organizationId ?? null,
        },
      };
    },
  },
};
