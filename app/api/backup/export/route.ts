import { authorizedForBackup, backupIsConfigured, createStockBackup } from "@/lib/server/stock-backup";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/backup?error=${error}`, request.url), { status: 303 });
}

export async function POST(request: Request) {
  if (!backupIsConfigured()) return back(request, "unconfigured");
  const form = await request.formData();
  if (!authorizedForBackup(String(form.get("password") ?? ""))) {
    return back(request, "password");
  }
  try {
    const backup = await createStockBackup();
    const day = backup.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(backup), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="bits-stock-backup-${day}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return back(request, "failed");
  }
}
