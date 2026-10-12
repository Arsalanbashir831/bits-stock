import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { formatPaisa, openPendingClaims, portalNotice } from "@/app/m/shared";

export const runtime = "nodejs";

export default async function EmployeeTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const [sheet, pendingClaims] = await Promise.all([
    prisma.stockSheet.findUnique({
      where: { sheetDate: today },
      include: {
        invoices: { select: { id: true, quantity: true, pricePaisa: true } },
        warrantyIns: { select: { id: true } },
        warrantyOuts: { select: { id: true } },
      },
    }),
    openPendingClaims(today),
  ]);

  const notice = portalNotice(query);
  const totalSalesPaisa = (sheet?.invoices ?? []).reduce((sum, entry) => sum + entry.quantity * entry.pricePaisa, 0);
  const readOnly = sheet?.status === "CLOSED";

  return (
    <>
      <div className="m-head">
        <h1>{formatSheetDate(today, { weekday: "long", day: "2-digit", month: "long" })}</h1>
        <p>{readOnly ? "Today’s report is closed — records are saved." : sheet ? "Today’s report is open for entries." : "Today’s report has not been created yet."}</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}

      {sheet ? (
        <>
          <div className="m-stats">
            <div className="m-stat"><span>Sale entries</span><strong>{String(sheet.invoices.length).padStart(2, "0")}</strong></div>
            <div className="m-stat"><span>Sales · PKR</span><strong>{formatPaisa(totalSalesPaisa)}</strong></div>
            <div className="m-stat"><span>Warranty in</span><strong>{String(sheet.warrantyIns.length).padStart(2, "0")}</strong></div>
            <div className="m-stat"><span>Warranty out</span><strong>{String(sheet.warrantyOuts.length).padStart(2, "0")}</strong></div>
          </div>

          <div className="m-card">
            <div className="m-kicker">Pending warranty carried into today</div>
            <div className="m-row">
              <div className="m-row-main">
                <strong>{String(pendingClaims.length).padStart(2, "0")} open {pendingClaims.length === 1 ? "claim" : "claims"}</strong>
                <span>Waiting for replacement or bill back</span>
              </div>
              <Link className="m-tag-link" href="/m/pending">View</Link>
            </div>
          </div>

          <div className="m-actions">
            <Link className="m-button" href="/m/sale"><span>Add invoice / sale</span><small>↗</small></Link>
            <Link className="m-button" href="/m/warranty"><span>Add warranty in / out</span><small>↗</small></Link>
            <Link className="m-button m-secondary" href={`/api/sheets/${dateKey}/pdf`}><span>Download stock report</span><small>PDF</small></Link>
          </div>
        </>
      ) : (
        <div className="m-empty">No stock sheet exists for today yet. Ask the office to create it before adding entries.</div>
      )}

      <div className="m-notice">Employee portal · entries go straight into today’s stock sheet.</div>
    </>
  );
}
