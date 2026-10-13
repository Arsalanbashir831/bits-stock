import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = [
    process.env.DATABASE_URL,
    process.env.BITSSTOCK_PRISMA_DATABASE_URL,
    process.env.BITSSTOCK_DATABASE_URL,
    process.env.BITSSTOCK_POSTGRES_URL,
  ].find((value) => value && /^postgres(?:ql)?:\/\//.test(value.trim()))?.trim();
  if (!connectionString) {
    throw new Error("Set DATABASE_URL or a BITSSTOCK_* PostgreSQL connection variable.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter, transactionOptions: { timeout: 30_000 } });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
