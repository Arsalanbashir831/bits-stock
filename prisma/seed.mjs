import "dotenv/config";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { initialCatalog } from "./catalog.mjs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const databasePath = databaseUrl.replace(/^file:/, "");
const database = new Database(databasePath);
const upsertProduct = database.prepare(`
  INSERT INTO Product (id, sku, name, category, sortOrder, isActive, createdAt, updatedAt)
  VALUES (@id, @sku, @name, @category, @sortOrder, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(sku) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    sortOrder = excluded.sortOrder,
    updatedAt = CURRENT_TIMESTAMP
`);

try {
  const seedCatalog = database.transaction(() => {
    for (const product of initialCatalog) {
      upsertProduct.run({ ...product, id: randomUUID() });
    }
  });
  seedCatalog();
  console.log(`Catalog ready: ${initialCatalog.length} stock sheet items.`);
} finally {
  database.close();
}
