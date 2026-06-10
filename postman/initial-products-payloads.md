# Initial Products Seeder

The initial control-cable catalog has been moved out of manual Postman payloads and into:

```bash
bun run seed:products
```

That command runs `prisma/seed-products.ts` directly. It is intentionally separate from `prisma/seed.ts`, so `bunx prisma db seed` still only runs the bootstrap admin seeder.

The product seeder upserts:

- 3 categories: `Clutch Cable`, `Brake Cable`, `Speedometer Cable`
- 22 catalog `Product` SKUs from the original inventory payload

It leaves `quantityOnHand`, supplier, location, and pricing untouched on existing products.
