import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env" });

const tables = [
  "Product",
  "Customer",
  "Supplier",
  "Party",
  "StockSheet",
  "StockReceipt",
  "Sale",
  "StockReceiptItem",
  "SaleItem",
  "WarrantyClaim",
  "StockMovement",
  "StockSheetLine",
  "InvoiceEntry",
  "WarrantyInEntry",
  "PendingWarrantyEntry",
  "WarrantyOutEntry",
  "PurchaseEntry",
  "LabDeadEntry",
];

const sqlitePath = resolve(process.argv[2] ?? "prisma/dev.db");
const databaseUrl = [
  process.env.DIRECT_URL,
  process.env.BITSSTOCK_DATABASE_URL,
  process.env.DATABASE_URL,
  process.env.BITSSTOCK_POSTGRES_URL,
  process.env.BITSSTOCK_PRISMA_DATABASE_URL,
].find((value) => value && /^postgres(?:ql)?:\/\//.test(value.trim()))?.trim();

if (!databaseUrl) {
  throw new Error("Set a PostgreSQL URL in DATABASE_URL or one of the BITSSTOCK_* variables.");
}

const exportRows = `
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.row_factory = sqlite3.Row
tables = json.loads(sys.argv[2])
result = {}
for table in tables:
    result[table] = [dict(row) for row in db.execute('SELECT * FROM "' + table + '"')]
print(json.dumps(result, default=str))
`;
const exported = spawnSync("python3", ["-c", exportRows, sqlitePath, JSON.stringify(tables)], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

if (exported.error) throw exported.error;
if (exported.status !== 0) {
  throw new Error(`Could not export SQLite data: ${exported.stderr || "Python exited unsuccessfully."}`);
}

const records = JSON.parse(exported.stdout);
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const targetCounts = await Promise.all(
    tables.map(async (table) => {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      return [table, result.rows[0].count];
    }),
  );
  const nonEmptyTables = targetCounts.filter(([, count]) => count > 0);
  if (nonEmptyTables.length) {
    throw new Error(
      `Import stopped because the PostgreSQL database already has data in: ${nonEmptyTables.map(([table]) => table).join(", ")}. No records were changed.`,
    );
  }

  let imported = 0;
  for (const table of tables) {
    for (const row of records[table]) {
      const columns = Object.keys(row);
      const values = columns.map((column) => {
        const value = row[column];
        return ["isActive", "billBackChecked"].includes(column) && value !== null
          ? Boolean(value)
          : value;
      });
      const identifiers = columns.map((column) => `"${column}"`).join(", ");
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      await client.query(
        `INSERT INTO "${table}" (${identifiers}) VALUES (${placeholders})`,
        values,
      );
      imported += 1;
    }
  }

  await client.query("COMMIT");
  console.log(`Imported ${imported} records from ${sqlitePath}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
