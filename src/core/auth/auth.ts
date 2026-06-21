import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, organization } from 'better-auth/plugins';

import { env } from '../config/env.config';
import { authPrisma } from './auth.client';
import { sessionHooks } from './auth.hooks';

const isProd = env.NODE_ENV === 'production';

// Better Auth instance. Mounted at /api/v1/auth by @thallesp/nestjs-better-auth.
//  - admin plugin        -> system-level role on user.role ('admin' = platform SUPER_ADMIN).
//  - organization plugin -> membership/roles on `members` (owner/admin/member); teams disabled.
//  - default scrypt password hashing.
//  - sign-up disabled     -> accounts are created only via the operator platform/admin endpoints.
export const auth = betterAuth({
  baseURL: env.APP_URL,
  basePath: '/api/v1/auth',
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),

  // Existing rows already carry their UUIDs; Prisma's @default(uuid()) supplies ids for new rows.
  advanced: {
    database: { generateId: false },
    // Cross-site cookies (frontend on a different origin than the API) need SameSite=None+Secure.
    ...(isProd ? { defaultCookieAttributes: { sameSite: 'none', secure: true } } : {}),
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
  },

  databaseHooks: {
    session: sessionHooks,
  },

  plugins: [
    admin(),
    organization({
      teams: { enabled: false },
    }),
  ],

  trustedOrigins: env.CORS_ALLOWED_ORIGINS,
});
