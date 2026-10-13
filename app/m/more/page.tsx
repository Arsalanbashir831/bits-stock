import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreviousBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";

export const runtime = "nodejs";

export default async function EmployeeMorePage() {
  await connection();
  const previousDateKey = getPreviousBusinessDateKey();
  const previousSheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(previousDateKey) }, select: { id: true } });
  return (
    <>
      <div className="m-head"><h1>More work</h1><p>Choose the record you need to check or update.</p></div>
      <div className="m-actions">
        <Link className="m-button" href="/m/pending"><span>See pending warranty</span><small>→</small></Link>
        <Link className="m-button" href="/m/billback"><span>Mark bill back</span><small>→</small></Link>
        <Link className="m-button" href="/m/lab-dead"><span>Record lab dead out</span><small>→</small></Link>
        <Link className="m-button m-secondary" href="/m/warranty/out"><span>Give warranty replacement</span><small>→</small></Link>
        {previousSheet && <Link className="m-button m-secondary" href={`/sheets/${previousDateKey}`}><span>Correct previous stock day</span><small>→</small></Link>}
      </div>
      <div className="m-notice">Made a mistake? Open the entry list on its page and tap “Edit entry.” You can delete an entry while today’s sheet is open.</div>
    </>
  );
}
