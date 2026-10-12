import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: "ok", database: "connected" });
  } catch {
    return Response.json(
      { status: "error", database: "disconnected" },
      { status: 503 },
    );
  }
}
