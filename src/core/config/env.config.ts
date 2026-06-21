import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Public origin of this API (no trailing slash). Better Auth uses it as its baseURL to
  // build cookie/callback URLs, e.g. https://assetwise-api.acethekawaii.work
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Runtime connection. In production this MUST be the least-privilege, non-superuser
  // app_user role (see prisma/rls-setup.sql), otherwise Row-Level Security is bypassed.
  DATABASE_URL: z.string().startsWith('postgresql://').min(1),

  // Optional owner/superuser connection used ONLY by `prisma migrate deploy` (DDL + RLS).
  // Falls back to DATABASE_URL when unset (fine for local dev).
  DIRECT_URL: z.string().startsWith('postgresql://').optional(),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:4200')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  // Better Auth signing secret (sessions/cookies). MUST be a stable, high-entropy value.
  BETTER_AUTH_SECRET: z.string().min(32),

  // When 'true', the app refuses to boot if its DB role bypasses Row-Level Security.
  // Leave 'false' during the initial single-tenant rollout; set 'true' once the backend
  // connects as app_user (and BEFORE provisioning a second organization).
  ENFORCE_RLS: z.enum(['true', 'false']).default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
