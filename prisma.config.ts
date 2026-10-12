import "dotenv/config";
import { defineConfig } from "prisma/config";

const migrationUrl = [
  process.env.DIRECT_URL,
  process.env.BITSSTOCK_DATABASE_URL,
  process.env.DATABASE_URL,
  process.env.BITSSTOCK_POSTGRES_URL,
  process.env.BITSSTOCK_PRISMA_DATABASE_URL,
].find((value) => value && /^postgres(?:ql)?:\/\//.test(value.trim()))?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
