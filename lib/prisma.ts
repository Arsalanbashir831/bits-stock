import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { databaseUrl } from "@/lib/server/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaCacheVersion?: number;
};

const PRISMA_CLIENT_CACHE_VERSION = 3;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: databaseUrl(),
    max: 5,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter, transactionOptions: { timeout: 30_000 } });
}

export const prisma =
  globalForPrisma.prismaCacheVersion === PRISMA_CLIENT_CACHE_VERSION && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaCacheVersion = PRISMA_CLIENT_CACHE_VERSION;
}
