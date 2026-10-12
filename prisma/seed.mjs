import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { initialCatalog } from "./catalog.mjs";

const databaseUrl = [
  process.env.DATABASE_URL,
  process.env.BITSSTOCK_PRISMA_DATABASE_URL,
  process.env.BITSSTOCK_DATABASE_URL,
  process.env.BITSSTOCK_POSTGRES_URL,
].find((value) => value && /^postgres(?:ql)?:\/\//.test(value.trim()))?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to a PostgreSQL connection string.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  for (const product of initialCatalog) {
    await client.query(
      `INSERT INTO "Product" ("id", "sku", "name", "category", "sortOrder", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("sku") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = CURRENT_TIMESTAMP`,
      [randomUUID(), product.sku, product.name, product.category, product.sortOrder],
    );
  }
  await client.query("COMMIT");
  console.log(`Catalog ready: ${initialCatalog.length} stock sheet items.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
