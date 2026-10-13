import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { Client } from "pg";
import { databaseUrl } from "@/lib/server/database-url";

// Parents precede their dependants so restore can preserve every original ID.
const TABLES = [
  "Product", "Customer", "Supplier", "Party", "StockSheet", "StockReceipt",
  "Sale", "StockReceiptItem", "SaleItem", "WarrantyClaim", "StockMovement",
  "StockSheetLine", "InvoiceEntry", "WarrantyInEntry", "PendingWarrantyEntry",
  "WarrantyOutEntry", "PurchaseEntry", "LabDeadEntry",
] as const;

type Table = (typeof TABLES)[number];
type Column = { name: string; type: string; nullable: boolean };
type Backup = {
  format: "bits-stock-database";
  version: 1;
  exportedAt: string;
  schema: Record<Table, Column[]>;
  tables: Record<Table, Record<string, unknown>[]>;
};

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function backupIsConfigured() {
  return Boolean(process.env.BACKUP_ADMIN_PASSWORD?.trim());
}

export function authorizedForBackup(password: string) {
  const configured = process.env.BACKUP_ADMIN_PASSWORD;
  if (!configured?.trim() || !password) return false;
  const suppliedHash = createHash("sha256").update(password).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(suppliedHash, configuredHash);
}

async function columnSchema(client: Client): Promise<Record<Table, Column[]>> {
  const result = {} as Record<Table, Column[]>;
  for (const table of TABLES) {
    const query = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
      [table],
    );
    if (!query.rows.length) throw new Error(`Database table ${table} is missing. Apply migrations first.`);
    result[table] = query.rows.map((row) => ({ name: row.column_name, type: row.data_type, nullable: row.is_nullable === "YES" }));
  }
  return result;
}

async function withDatabase<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 5_000 });
  await client.connect();
  try { return await run(client); } finally { await client.end(); }
}

export async function createStockBackup(): Promise<Backup> {
  return withDatabase(async (client) => {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const schema = await columnSchema(client);
      const tables = {} as Backup["tables"];
      for (const table of TABLES) {
        const rows = await client.query(`SELECT * FROM "${table}"`);
        tables[table] = rows.rows as Record<string, unknown>[];
      }
      await client.query("COMMIT");
      return { format: "bits-stock-database", version: 1, exportedAt: new Date().toISOString(), schema, tables };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBackup(value: unknown, schema: Backup["schema"]): Backup {
  if (!isRecord(value) || value.format !== "bits-stock-database" || value.version !== 1 ||
      !isRecord(value.schema) || !isRecord(value.tables)) {
    throw new Error("This is not a supported Bits Stock backup file.");
  }
  if (Object.keys(value.tables).length !== TABLES.length || Object.keys(value.schema).length !== TABLES.length) {
    throw new Error("The backup does not include every application table.");
  }
  for (const table of TABLES) {
    const expected = schema[table];
    if (JSON.stringify(value.schema[table]) !== JSON.stringify(expected)) {
      throw new Error(`The backup schema differs from this database at ${table}.`);
    }
    const rows = value.tables[table];
    if (!Array.isArray(rows)) throw new Error(`The ${table} records are invalid.`);
    const keys = expected.map((column) => column.name).sort();
    for (const row of rows) {
      if (!isRecord(row) || JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(keys)) {
        throw new Error(`A ${table} record has invalid fields.`);
      }
      for (const column of expected) {
        const field = row[column.name];
        if (field === null) {
          if (!column.nullable) throw new Error(`A ${table} record is missing ${column.name}.`);
        } else if (column.type.includes("timestamp") || column.type === "date") {
          if (typeof field !== "string" || Number.isNaN(Date.parse(field))) throw new Error(`Invalid date in ${table}.`);
        } else if (column.type === "integer" || column.type === "bigint" || column.type === "numeric") {
          if (typeof field !== "number" || !Number.isSafeInteger(field)) throw new Error(`Invalid number in ${table}.`);
        } else if (column.type === "boolean") {
          if (typeof field !== "boolean") throw new Error(`Invalid value in ${table}.`);
        } else if (typeof field !== "string") {
          throw new Error(`Invalid text in ${table}.`);
        }
      }
    }
  }
  return value as Backup;
}

export async function restoreStockBackup(raw: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("The selected file is not valid JSON."); }
  return withDatabase(async (client) => {
    await client.query("BEGIN");
    try {
      // Lock serializes restores and prevents two admin imports from interleaving.
      await client.query("SELECT pg_advisory_xact_lock(74192863)");
      const schema = await columnSchema(client);
      const backup = validateBackup(parsed, schema);
      for (const table of [...TABLES].reverse()) await client.query(`DELETE FROM "${table}"`);
      let total = 0;
      for (const table of TABLES) {
        const columns = schema[table].map((column) => column.name);
        const names = columns.map((column) => `"${column}"`).join(", ");
        const rows = backup.tables[table];
        for (let offset = 0; offset < rows.length; offset += 100) {
          const batch = rows.slice(offset, offset + 100);
          const values: unknown[] = [];
          const placeholders = batch.map((row) => {
            const fields = columns.map((column) => {
              values.push(row[column]);
              return `$${values.length}`;
            });
            return `(${fields.join(", ")})`;
          });
          await client.query(`INSERT INTO "${table}" (${names}) VALUES ${placeholders.join(", ")}`, values);
          total += batch.length;
        }
      }
      await client.query("COMMIT");
      return total;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
