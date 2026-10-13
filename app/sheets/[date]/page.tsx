import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, getPreviousBusinessDateKey, isTodayOrYesterday, toSheetDate } from "@/lib/stock-sheet-date";
import { comparePartyNames, sortPartyEntries } from "@/lib/party-sort";
import { DailyEntrySections } from "./daily-entry-sections";
import { CloseStockSheet } from "../close-stock-sheet";

export const runtime = "nodejs";

const fields = [
  ["faultyForLab", "Faulty for lab"],
  ["pendingWarranty", "Pending / warranty"],
  ["closingQtyInHand", "Closing qty in hand"],
  ["openingQtyInHand", "Qty in hand"],
  ["openingPw", "PW"],
  ["purchase", "Purch."],
  ["warrantyIn", "Warranty in"],
  ["sale", "Sale"],
  ["warrantyOut", "Warranty out"],
  ["labDead", "Lab dead"],
] as const;

type FieldKey = (typeof fields)[number][0];
type SheetLine = {
  id: string;
  itemName: string;
  sectionName: string | null;
  product: { sortOrder: number };
} & Record<FieldKey, number>;

const sectionOrder = [
  "Desktop Drives",
  "Laptop Drives",
  "Solid State Drives",
  "Accessories",
  "Other",
];

function sectionRank(section: string | null) {
  const index = sectionOrder.indexOf(section ?? "Other");
  return index < 0 ? sectionOrder.length : index;
}

function displayQuantity(value: number) {
  return value === 0 ? "" : value.toLocaleString("en-PK");
}

export default async function StockSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ date }, query] = await Promise.all([params, searchParams]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const sheetDate = toSheetDate(date);
  if (Number.isNaN(sheetDate.getTime()) || sheetDate.toISOString().slice(0, 10) !== date) notFound();

  const stockSheet = await prisma.stockSheet.findUnique({
    where: { sheetDate },
    include: {
      lines: {
        include: { product: { select: { name: true, category: true, sortOrder: true } } },
      },
      invoices: { orderBy: { createdAt: "desc" } },
      warrantyIns: { orderBy: { createdAt: "desc" } },
      warrantyOuts: { orderBy: { createdAt: "desc" }, include: { pendingWarrantyEntry: { select: { rmaNumber: true } } } },
      purchases: { orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } } } },
      labDeadEntries: { orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } } } },
    },
  });

  if (!stockSheet) notFound();

  const previousDateKey = getPreviousBusinessDateKey();
  const [pendingWarranties, products, parties, yesterdaySheet] = await Promise.all([prisma.pendingWarrantyEntry.findMany({
    where: {
      receivedDate: { lt: sheetDate },
      stockSheet: { sheetDate: { lte: sheetDate } },
      AND: [
        { OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheetDate } }] },
        { OR: [{ billBackDate: null }, { billBackDate: { gte: sheetDate } }] },
      ],
    },
    orderBy: [{ party: "asc" }, { receivedDate: "asc" }, { itemName: "asc" }],
  }), prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  }), prisma.party.findMany({ orderBy: { name: "asc" }, select: { name: true } }), date === getBusinessDateKey() ? prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(previousDateKey) }, select: { sheetDate: true } }) : Promise.resolve(null)]);
  const sortedPendingWarranties = [...pendingWarranties].sort((left, right) =>
    comparePartyNames(left.party, right.party) ||
    left.receivedDate.getTime() - right.receivedDate.getTime() ||
    left.itemName.localeCompare(right.itemName, "en", { sensitivity: "base" }),
  );
  const warrantyIns = sortPartyEntries(stockSheet.warrantyIns);
  const warrantyOuts = sortPartyEntries(stockSheet.warrantyOuts);
  const lines = [...stockSheet.lines].sort(
    (a, b) =>
      sectionRank(a.sectionName) - sectionRank(b.sectionName) ||
      (a.sectionName ?? "Other").localeCompare(b.sectionName ?? "Other") ||
      a.product.sortOrder - b.product.sortOrder ||
      a.itemName.localeCompare(b.itemName),
  ) as SheetLine[];
  const sections = [...new Set(lines.map((line) => line.sectionName ?? "Other"))];
  const totals = Object.fromEntries(
    fields.map(([key]) => [key, lines.reduce((sum, line) => sum + line[key], 0)]),
  ) as Record<FieldKey, number>;
  const showClosing = stockSheet.status === "CLOSED" || stockSheet.closingPreparedAt !== null;
  const editOnly = stockSheet.status === "CLOSED" && isTodayOrYesterday(date);
  const totalSalesPaisa = stockSheet.invoices.reduce(
    (sum, entry) => sum + entry.quantity * entry.pricePaisa,
    0,
  );

  return (
    <main className="sheet-page">
      <header className="sheet-toolbar">
        <Link href="/" className="back-link"><span aria-hidden="true">←</span> All stock sheets</Link>
        <div className="sheet-toolbar-meta"><Link href="/entries" className="toolbar-active-link">TODAY’S ENTRIES ↗</Link><span className="toolbar-divider" /><span className="saved-status"><i />SAVED REPORT</span><span className="toolbar-divider" /><span>DAILY SNAPSHOT</span></div>
      </header>

      <div className="sheet-page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-rule" />BITS STOCK REPORT <span className="eyebrow-index">/ DAILY</span></div>
          <h1>Stock report<span className="heading-period">.</span></h1>
          <p>Snapshot created {formatSheetDate(stockSheet.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <div className="report-heading-actions">
          <a className="download-sheet-button" href={`/api/sheets/${date}/pdf`}>
            <span aria-hidden="true">↓</span> Download stock sheet PDF
          </a>
          {yesterdaySheet && <Link className="download-sheet-button" href={`/sheets/${previousDateKey}`}>Edit yesterday’s entries <span aria-hidden="true">↗</span></Link>}
          <CloseStockSheet dateKey={date} status={stockSheet.status} closedAt={stockSheet.closedAt} closingPreparedAt={stockSheet.closingPreparedAt} />
          <div className="report-date-stamp"><span>DATED</span><strong>{formatSheetDate(stockSheet.sheetDate, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong></div>
        </div>
      </div>

      <section id="stock-report" className="report-card" aria-label={`Stock report for ${formatSheetDate(stockSheet.sheetDate)}`}>
        <div className="report-card-topline"><span>BITS STOCK REPORT · {formatSheetDate(stockSheet.sheetDate, { day: "2-digit", month: "short", year: "numeric" })}</span><span>{String(lines.length).padStart(2, "0")} ITEMS <i /> REPORT NO. {stockSheet.id.slice(-6).toUpperCase()}</span></div>
          <div className="stock-table-scroll">
            <table className="stock-sheet-table">
            <caption className="sr-only">Daily BITS stock report for {formatSheetDate(stockSheet.sheetDate)}</caption>
            <colgroup>
              <col className="item-column" />
              {fields.map(([key]) => <col key={key} className={`field-${key}`} />)}
            </colgroup>
            <thead>
              <tr className="group-header-row">
                <th rowSpan={2} scope="col" className="item-header">ITEMS<br /><span>DETAIL</span></th>
                <th colSpan={3} scope="colgroup" className="closing-group">CLSG QTY</th>
                <th colSpan={2} scope="colgroup">OPENING</th>
                <th colSpan={2} scope="colgroup">IN <span>(UNITS)</span></th>
                <th colSpan={3} scope="colgroup">OUT <span>(UNITS)</span></th>
              </tr>
              <tr className="sub-header-row">
                <th scope="col">Faulty<br />for lab</th>
                <th scope="col">Pending /<br />warranty</th>
                <th scope="col">Closing qty<br />in hand</th>
                <th scope="col">Qty<br />in hand</th>
                <th scope="col">PW</th>
                <th scope="col">Purch.</th>
                <th scope="col">Warranty<br />in</th>
                <th scope="col">Sale</th>
                <th scope="col">Warranty<br />out</th>
                <th scope="col">Lab<br />dead</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const sectionLines = lines.filter((line) => (line.sectionName ?? "Other") === section);
                return <FragmentSection key={section} section={section} lines={sectionLines} showClosing={showClosing} />;
              })}
              <tr className="grand-total-row">
                <th scope="row">TOTAL</th>
                {fields.map(([key]) => <td key={key}>{showClosing || !isClosingField(key) ? displayQuantity(totals[key]) : ""}</td>)}
              </tr>
            </tbody>
            </table>
          </div>
        <footer className="report-card-footer"><span>ONE RECORD PER BUSINESS DAY</span><span>ARCHIVED AFTER DAILY CLOSE</span></footer>
      </section>
      {query.error && <div className="notice error-notice report-error">{query.error === "closed" ? "This stock sheet is closed. Its entries are read-only." : query.error === "prepare-close" ? "Prepare the closing quantities before confirming the close." : "Some details are missing or invalid. Review the entry and try again."}</div>}
      {query.closed && <div className="notice success-notice report-error">Stock sheet closed and added to daily history.</div>}
      {query.prepared && <div className="notice success-notice report-error">Closing quantities calculated. Review CLSG QTY, then confirm closing.</div>}
      <DailyEntrySections
        dateKey={date}
        readOnly={stockSheet.status === "CLOSED"}
        editOnly={editOnly}
        products={products}
        invoices={stockSheet.invoices}
        parties={parties}
        warrantyIns={warrantyIns}
        warrantyOuts={warrantyOuts}
        pendingWarranties={sortedPendingWarranties.map((entry) => ({ ...entry, billBackChecked: entry.billBackDate?.getTime() === sheetDate.getTime() }))}
        purchases={stockSheet.purchases}
        labDeadEntries={stockSheet.labDeadEntries}
        billBackPaisa={stockSheet.billBackPaisa}
        deadOutQuantity={stockSheet.deadOutQuantity}
        totalSalesPaisa={totalSalesPaisa}
      />
      <div className="sheet-page-foot"><span>BITS STOCK REPORTING</span><Link href="/">RETURN TO DAILY HISTORY <span aria-hidden="true">↗</span></Link></div>
    </main>
  );
}

const closingFieldKeys = new Set<FieldKey>(["faultyForLab", "pendingWarranty", "closingQtyInHand"]);
function isClosingField(key: FieldKey) { return closingFieldKeys.has(key); }

function FragmentSection({ section, lines, showClosing }: { section: string; lines: SheetLine[]; showClosing: boolean }) {
  const sectionTotals = Object.fromEntries(
    fields.map(([key]) => [key, lines.reduce((sum, line) => sum + line[key], 0)]),
  ) as Record<FieldKey, number>;

  return (
    <>
      <tr className="section-label-row"><th colSpan={11} scope="colgroup">{section}<span>{String(lines.length).padStart(2, "0")} ITEMS</span></th></tr>
      {lines.map((line) => (
        <tr className="product-row" key={line.id}>
          <th scope="row">{line.itemName}</th>
          {fields.map(([key]) => <td key={key}>{showClosing || !isClosingField(key) ? displayQuantity(line[key]) : ""}</td>)}
        </tr>
      ))}
      <tr className="section-total-row">
        <th scope="row">TOTAL</th>
        {fields.map(([key]) => <td key={key}>{showClosing || !isClosingField(key) ? displayQuantity(sectionTotals[key]) : ""}</td>)}
      </tr>
    </>
  );
}
