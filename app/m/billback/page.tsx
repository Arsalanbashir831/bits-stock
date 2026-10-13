import { getBusinessDateKey, formatSheetDate, toSheetDate } from "@/lib/stock-sheet-date";
import { prisma } from "@/lib/prisma";
import { portalNotice } from "@/app/m/shared";
import BillBackForm from "./billback-form";
import { setPendingWarrantyBillBackCheck } from "@/app/actions/stock-sheets";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";

export const runtime = "nodejs";

export default async function EmployeeBillBackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const [sheet, entries, markedToday] = await Promise.all([
    prisma.stockSheet.findUnique({ where: { sheetDate: today }, select: { status: true } }),
    prisma.pendingWarrantyEntry.findMany({
      where: {
        receivedDate: { lte: today },
        stockSheet: { sheetDate: { lte: today } },
        AND: [
          { OR: [{ resolvedDate: null }, { resolvedDate: { gt: today } }] },
          { OR: [{ billBackDate: null }, { billBackDate: { gt: today } }] },
        ],
      },
      include: {
        sourceWarrantyIn: {
          select: {
            invoiceNumber: true,
            invoiceDate: true,
            stockSheet: { select: { sheetDate: true } },
          },
        },
      },
      orderBy: [{ party: "asc" }, { receivedDate: "asc" }, { itemName: "asc" }],
    }),
    prisma.pendingWarrantyEntry.findMany({
      where: { billBackDate: today },
      orderBy: [{ party: "asc" }, { itemName: "asc" }],
    }),
  ]);
  const readOnly = !sheet || sheet.status !== "OPEN";
  const notice = portalNotice(query);
  const claims = entries.map((entry) => ({
    id: entry.id,
    party: entry.party,
    itemName: entry.itemName,
    receivedDate: formatSheetDate(entry.receivedDate, { day: "2-digit", month: "short", year: "numeric" }),
    quantity: entry.quantity,
    invoiceDate: formatSheetDate(entry.sourceWarrantyIn?.invoiceDate ?? entry.invoiceDate, { day: "2-digit", month: "short", year: "numeric" }),
    invoiceNumber: entry.sourceWarrantyIn?.invoiceNumber ?? "",
    rmaNumber: entry.rmaNumber,
    amountPaisa: entry.amountPaisa,
    source: entry.sourceWarrantyIn?.stockSheet.sheetDate.getTime() === today.getTime()
      ? "Warranty IN"
      : "Pending Warranty",
  }));

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Bill back · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Bill Back</h1>
        <p>Select an open Warranty IN or pending warranty claim to record its bill back today.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice error">Today’s stock sheet is closed. New entries are locked.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}
      <BillBackForm claims={claims} dateKey={dateKey} disabled={readOnly} />

      <section className="m-card">
        <div className="m-card-title"><span>Bill backs marked today</span><span className="m-kicker">{String(markedToday.length).padStart(2, "0")}</span></div>
        {markedToday.length ? (
          <div className="m-rows">
            {markedToday.map((entry) => (
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main"><strong>{entry.party} · {entry.itemName}</strong><span>RMA {entry.rmaNumber} · {entry.quantity} units · PKR {new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(entry.amountPaisa / 100)}</span></div>
                </div>
                {!readOnly && !entry.resolvedDate && <details className="m-entry-edit">
                  <summary>Remove bill back mark</summary>
                  <DeleteEntryForm action={setPendingWarrantyBillBackCheck}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/billback" />
                    <input type="hidden" name="pendingWarrantyId" value={entry.id} />
                    <input type="hidden" name="billBackChecked" value="false" />
                    <button className="m-delete-button" type="submit">Undo bill back</button>
                  </DeleteEntryForm>
                </details>}
                {entry.resolvedDate && <span className="m-hint">Already resolved by a warranty out entry.</span>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No bill backs marked today.</div>}
      </section>
    </>
  );
}
