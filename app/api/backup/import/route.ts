import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizedForBackup, backupIsConfigured, MAX_BACKUP_BYTES, restoreStockBackup } from "@/lib/server/stock-backup";

export const runtime = "nodejs";
export const maxDuration = 300;

function back(request: Request, result: string) {
  return NextResponse.redirect(new URL(`/backup?${result}`, request.url), { status: 303 });
}

export async function POST(request: Request) {
  if (!backupIsConfigured()) return back(request, "error=unconfigured");
  if (Number(request.headers.get("content-length")) > MAX_BACKUP_BYTES + 1024 * 1024) return back(request, "error=size");
  const form = await request.formData();
  if (!authorizedForBackup(String(form.get("password") ?? ""))) return back(request, "error=password");
  if (form.get("confirmation") !== "RESTORE") return back(request, "error=confirmation");
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".json") || file.size === 0) {
    return back(request, "error=file");
  }
  if (file.size > MAX_BACKUP_BYTES) return back(request, "error=size");
  try {
    const rows = await restoreStockBackup(await file.text());
    for (const path of ["/", "/entries", "/m", "/m/sale", "/m/warranty", "/m/warranty/out", "/m/pending", "/m/billback", "/m/lab-dead"]) {
      revalidatePath(path);
    }
    revalidatePath("/sheets/[date]", "page");
    return back(request, `restored=${rows}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const type = /backup|schema|record|date|number|text|value|JSON/.test(message) ? "invalid" : "failed";
    return back(request, `error=${type}`);
  }
}
