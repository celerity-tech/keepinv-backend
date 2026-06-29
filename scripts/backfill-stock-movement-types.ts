import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import {
  STOCK_MOVEMENT_TYPE_BACKFILL_DEFAULTS,
} from '../src/modules/stock-movement-types/constants/stock-movement-type.constants';

const databaseUrl = process.env.DIRECT_URL;
if (!databaseUrl) {
  console.error('Missing DIRECT_URL. Run this backfill with the PostgreSQL owner connection.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })),
});

async function backfillStockMovementTypes(): Promise<void> {
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

      const organizations = await tx.organization.findMany({ select: { id: true } });
      let updatedMovements = 0;

      for (const organization of organizations) {
        await tx.stockMovementType.createMany({
          data: STOCK_MOVEMENT_TYPE_BACKFILL_DEFAULTS.map((movementType) => ({
            ...movementType,
            organizationId: organization.id,
          })),
          skipDuplicates: true,
        });

        const movementTypes = await tx.stockMovementType.findMany({
          where: { organizationId: organization.id, systemKey: { not: null } },
          select: { id: true, systemKey: true },
        });

        for (const movementType of movementTypes) {
          if (!movementType.systemKey) continue;

          const updated = await tx.$executeRaw`
            UPDATE "stock_movements"
            SET "stock_movement_type_id" = ${movementType.id}
            WHERE "organization_id" = ${organization.id}
              AND "type"::text = ${movementType.systemKey}
              AND "stock_movement_type_id" IS NULL
          `;
          updatedMovements += updated;
        }
      }

      const [remaining] = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS "count"
        FROM "stock_movements"
        WHERE "stock_movement_type_id" IS NULL
      `;
      const remainingMovements = Number(remaining?.count ?? 0n);
      if (remainingMovements > 0) {
        throw new Error(
          `${remainingMovements} stock movement(s) could not be matched to a movement type`,
        );
      }

      await tx.$executeRawUnsafe(
        'ALTER TABLE "stock_movement_types" ENABLE ROW LEVEL SECURITY',
      );
      await tx.$executeRawUnsafe(
        'ALTER TABLE "stock_movement_types" FORCE ROW LEVEL SECURITY',
      );
      await tx.$executeRawUnsafe(
        'DROP POLICY IF EXISTS "tenant_isolation" ON "stock_movement_types"',
      );
      await tx.$executeRawUnsafe(`
        CREATE POLICY "tenant_isolation" ON "stock_movement_types"
        USING (
          current_setting('app.bypass_rls', true) = 'on'
          OR "organization_id" = current_setting('app.current_org_id', true)
        )
        WITH CHECK (
          current_setting('app.bypass_rls', true) = 'on'
          OR "organization_id" = current_setting('app.current_org_id', true)
        )
      `);

      return { organizations: organizations.length, updatedMovements };
    },
    { maxWait: 10_000, timeout: 300_000 },
  );

  console.log(
    `Stock movement types aligned for ${result.organizations} organization(s); ` +
      `${result.updatedMovements} movement(s) backfilled.`,
  );
}

backfillStockMovementTypes()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
