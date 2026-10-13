import "server-only";

export function databaseUrl() {
  const value = [
    process.env.DATABASE_URL,
    process.env.BITSSTOCK_PRISMA_DATABASE_URL,
    process.env.BITSSTOCK_DATABASE_URL,
    process.env.BITSSTOCK_POSTGRES_URL,
  ].find((candidate) => candidate && /^postgres(?:ql)?:\/\//.test(candidate.trim()))?.trim();
  if (!value) throw new Error("Set DATABASE_URL or a BITSSTOCK_* PostgreSQL connection variable.");
  return value;
}
