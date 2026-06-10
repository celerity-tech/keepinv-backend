import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: DATABASE_URL })),
});

const CATEGORY_SEEDS = {
  clutch: {
    name: 'Clutch Cable',
    description: 'Motorcycle clutch control cables',
  },
  brake: {
    name: 'Brake Cable',
    description: 'Motorcycle brake control cables',
  },
  speedometer: {
    name: 'Speedometer Cable',
    description: 'Motorcycle speedometer drive cables',
  },
} as const;

type CategoryKey = keyof typeof CATEGORY_SEEDS;

type ProductSeed = {
  name: string;
  sku: string;
  brand?: string;
  categoryKey: CategoryKey;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  { name: 'HD3 Clutch Cable', sku: 'CLT-HD3-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'GR125 Clutch Cable', sku: 'CLT-GR125-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'Rouser 135 L-TE Clutch Cable', sku: 'CLT-RS135-UH', brand: 'UH', categoryKey: 'clutch' },
  { name: 'Raider 150 Clutch Cable', sku: 'CLT-RDR150-1101', brand: '1101', categoryKey: 'clutch' },
  { name: 'Raider 150 Fi Clutch Cable', sku: 'CLT-RDR150FI-VLT', brand: 'Valiant', categoryKey: 'clutch' },
  { name: 'Sniper 150 Clutch Cable', sku: 'CLT-SNP150-KRY', brand: 'Kryon', categoryKey: 'clutch' },
  { name: 'YMX 125 Alpha Brake Cable', sku: 'BRK-YMX125-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Barako 175 Brake Cable', sku: 'BRK-BRK175-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Barako 175 Brake Cable (Otaka)', sku: 'BRK-BRK175-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'HD3 Brake Cable', sku: 'BRK-HD3-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Wygo Brake Cable', sku: 'BRK-WYGO', categoryKey: 'brake' },
  { name: 'Wave 100 Brake Cable', sku: 'BRK-WAVE100-GRR', brand: 'GRR', categoryKey: 'brake' },
  { name: 'Beat Fi Brake Cable', sku: 'BRK-BEATFI-ZCH', brand: 'Zecheng', categoryKey: 'brake' },
  { name: 'Click 125 Brake Cable', sku: 'BRK-CLICK125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Mio 125 Brake Cable', sku: 'BRK-MIO125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Mio Brake Cable', sku: 'BRK-MIO-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'RM100 Brake Cable', sku: 'BRK-RM100-YHK', brand: 'YHK', categoryKey: 'brake' },
  { name: 'RM100 Speedometer Cable', sku: 'SPD-RM100-EIKO', brand: 'Eiko', categoryKey: 'speedometer' },
  { name: 'Rouser 135 Speedometer Cable', sku: 'SPD-RS135-ORT', brand: 'Ortaine', categoryKey: 'speedometer' },
  { name: 'Rmahn 110 Speedometer Cable', sku: 'SPD-RMAHN110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Rmahn 115 Speedometer Cable', sku: 'SPD-RMAHN115-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Raider J 110 Speedometer Cable', sku: 'SPD-RDRJ110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
];

async function upsertCategory(
  tx: Prisma.TransactionClient,
  seed: (typeof CATEGORY_SEEDS)[CategoryKey],
) {
  const existing = await tx.category.findFirst({
    where: { name: { equals: seed.name, mode: 'insensitive' } },
  });

  if (existing) {
    return tx.category.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        description: seed.description,
        isArchived: false,
      },
    });
  }

  return tx.category.create({ data: seed });
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const categoryIdByKey = new Map<CategoryKey, string>();
    const categoryEntries = Object.entries(CATEGORY_SEEDS) as [
      CategoryKey,
      (typeof CATEGORY_SEEDS)[CategoryKey],
    ][];

    for (const [key, seed] of categoryEntries) {
      const category = await upsertCategory(tx, seed);
      categoryIdByKey.set(key, category.id);
    }

    for (const seed of PRODUCT_SEEDS) {
      const categoryId = categoryIdByKey.get(seed.categoryKey);
      if (!categoryId) {
        throw new Error(`Missing seeded category for "${seed.categoryKey}".`);
      }

      await tx.product.upsert({
        where: { sku: seed.sku },
        create: {
          name: seed.name,
          sku: seed.sku,
          brand: seed.brand ?? null,
          categoryId,
        },
        update: {
          name: seed.name,
          brand: seed.brand ?? null,
          categoryId,
          isArchived: false,
        },
      });
    }
  });

  console.log(`Seeded ${Object.keys(CATEGORY_SEEDS).length} categories and ${PRODUCT_SEEDS.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
