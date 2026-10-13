import Link from "next/link";
import { createTodayStockSheet } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, getPreviousBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { comparePartyNames, sortPartyEntries } from "@/lib/party-sort";
import { DailyEntrySections } from "@/app/sheets/[date]/daily-entry-sections";
import { CloseStockSheet } from "@/app/sheets/close-stock-sheet";

export const runtime = "nodejs";

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const stockSheet = await prisma.stockSheet.findUnique({
    where: { sheetDate: today },
    include: {
      invoices: { orderBy: { createdAt: "desc" } },
      warrantyIns: { orderBy: { createdAt: "desc" } },
      warrantyOuts: { orderBy: { createdAt: "desc" }, include: { pendingWarrantyEntry: { select: { rmaNumber: true } } } },
      purchases: { orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } } } },
      labDeadEntries: { orderBy: { createdAt: "desc" }, include: { product: { select: { name: true } } } },
    },
  });

  if (!stockSheet) {
    return (
      <main className="sheet-page entries-page today-entries-page">
        <header className="sheet-toolbar"><Link href="/" className="back-link"><span aria-hidden="true">←</span> All stock sheets</Link><div className="sheet-toolbar-meta"><span>TODAY’S ENTRY WORKSPACE</span></div></header>
        <div className="sheet-page-heading entries-page-heading">
          <div><div className="eyebrow"><span className="eyebrow-rule" />DAILY OPERATIONS <span className="eyebrow-index">/ TODAY</span></div><h1>Today’s entries<span className="heading-period">.</span></h1><p>{formatSheetDate(today, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p></div>
          <Link className="download-sheet-button" href="/">View stock sheets <span aria-hidden="true">↗</span></Link>
        </div>
        {query.error && <div className="notice error-notice report-error">Some details are missing or invalid. Check the entry form and try again.</div>}
        <section className="today-entry-start-card"><span className="section-kicker">NO DAILY REPORT YET</span><h2>Create today’s stock sheet before adding entries.</h2><p>All sales, warranty, purchase, and lab records are saved against today’s report.</p><form action={createTodayStockSheet}><button type="submit" className="entry-submit">Create today’s report <span aria-hidden="true">↗</span></button></form></section>
        <footer className="sheet-page-foot"><span>BITS STOCK REPORTING</span><Link href="/">RETURN TO DAILY SHEETS <span aria-hidden="true">↗</span></Link></footer>
      </main>
    );
  }

  const previousDateKey = getPreviousBusinessDateKey();
  const [products, parties, pendingWarranties, yesterdaySheet] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.party.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.pendingWarrantyEntry.findMany({
      where: {
        receivedDate: { lt: today },
        stockSheet: { sheetDate: { lte: today } },
        AND: [
          { OR: [{ resolvedDate: null }, { resolvedDate: { gt: today } }] },
          { OR: [{ billBackDate: null }, { billBackDate: { gte: today } }] },
        ],
      },
      orderBy: [{ party: "asc" }, { receivedDate: "asc" }, { itemName: "asc" }],
    }),
    prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(previousDateKey) }, select: { id: true } }),
  ]);
  const sortedPendingWarranties = [...pendingWarranties].sort((left, right) =>
    comparePartyNames(left.party, right.party) ||
    left.receivedDate.getTime() - right.receivedDate.getTime() ||
    left.itemName.localeCompare(right.itemName, "en", { sensitivity: "base" }),
  );
  const warrantyIns = sortPartyEntries(stockSheet.warrantyIns);
  const warrantyOuts = sortPartyEntries(stockSheet.warrantyOuts);
  const openWarrantyCount = pendingWarranties.filter((entry) => entry.billBackDate?.getTime() !== today.getTime()).length;
  const editOnly = stockSheet.status === "CLOSED";
  const totalSalesPaisa = stockSheet.invoices.reduce((sum, entry) => sum + entry.quantity * entry.pricePaisa, 0);

  const navLinks = [
    { label: "Sale Entry", anchor: "invoices", count: stockSheet.invoices.length },
    { label: "Warranty In & Out Entry", anchor: "today-warranty-in", count: stockSheet.warrantyIns.length + stockSheet.warrantyOuts.length, children: [{ label: "Warranty In", anchor: "today-warranty-in" }, { label: "Warranty Out", anchor: "today-warranty-out" }] },
    { label: "Pending Warranty", anchor: "pending-warranty", count: openWarrantyCount },
    { label: "Lab Dead", anchor: "lab-dead", count: stockSheet.labDeadEntries.length },
    { label: "Purchase Entry", anchor: "purchases", count: stockSheet.purchases.length },
  ];

  return (
    <main className="sheet-page entries-page today-entries-page">
      <header className="sheet-toolbar"><Link href="/" className="back-link"><span aria-hidden="true">←</span> All stock sheets</Link><div className="sheet-toolbar-meta"><span>TODAY’S ENTRY WORKSPACE</span><span className="toolbar-divider" /><span>{formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</span></div></header>
      <div className="sheet-page-heading entries-page-heading">
        <div><div className="eyebrow"><span className="eyebrow-rule" />DAILY OPERATIONS <span className="eyebrow-index">/ TODAY</span></div><h1>Today’s entries<span className="heading-period">.</span></h1><p>Add and review today’s sales, warranty, and stock movement entries.</p></div>
        <div className="entries-page-actions">
          <Link className="download-sheet-button" href={`/sheets/${dateKey}`}>Open today’s stock sheet <span aria-hidden="true">↗</span></Link>
          {yesterdaySheet && <Link className="download-sheet-button" href={`/sheets/${previousDateKey}`}>Edit yesterday’s entries <span aria-hidden="true">↗</span></Link>}
          <CloseStockSheet dateKey={dateKey} status={stockSheet.status} closedAt={stockSheet.closedAt} closingPreparedAt={stockSheet.closingPreparedAt} returnToEntries />
        </div>
      </div>
      {query.error && <div className="notice error-notice report-error">{query.error === "closed" ? "This stock sheet is closed. Its entries are read-only." : query.error === "prepare-close" ? "Prepare the closing quantities before confirming the close." : "Some details are missing or invalid. Check the entry form and try again."}</div>}
      {query.closed && <div className="notice success-notice report-error">Today’s stock sheet is closed and saved in daily history.</div>}
      {query.prepared && <div className="notice success-notice report-error">Closing quantities calculated. Review CLSG QTY, then confirm closing.</div>}

      <nav className="entry-workspace-mobile-nav" aria-label="Entry categories">
        {navLinks.map((item) => <span className="entry-workspace-mobile-group" key={item.label}><a href={`#${item.anchor}`}>{item.label}<b>{String(item.count).padStart(2, "0")}</b></a>{item.children?.map((child) => <a className="entry-workspace-mobile-subnav" href={`#${child.anchor}`} key={child.anchor}>{child.label}<span>↗</span></a>)}</span>)}
      </nav>

      <div className="entry-workspace-layout">
        <aside className="entry-workspace-sidebar">
          <div className="entry-workspace-sidebar-head"><span className="section-kicker">TODAY · {formatSheetDate(today, { day: "2-digit", month: "short" })}</span><strong>ENTRY MENU</strong></div>
          <nav aria-label="Today’s entry sections">
            {navLinks.map((item) => (
              <div className="entry-workspace-nav-group" key={item.label}>
                <a className="entry-workspace-nav-link" href={`#${item.anchor}`}><span>{item.label}</span><b>{String(item.count).padStart(2, "0")}</b></a>
                {item.children && <div className="entry-workspace-subnav">{item.children.map((child) => <a key={child.anchor} href={`#${child.anchor}`}>{child.label}<span>↗</span></a>)}</div>}
              </div>
            ))}
          </nav>
          <div className="entry-workspace-sidebar-foot"><i />Changes update today’s stock sheet automatically.</div>
        </aside>

        <div className="entry-workspace-content">
          <DailyEntrySections
            dateKey={dateKey}
            readOnly={stockSheet.status === "CLOSED"}
            editOnly={editOnly}
            products={products}
            parties={parties}
            invoices={stockSheet.invoices}
            warrantyIns={warrantyIns}
            warrantyOuts={warrantyOuts}
            pendingWarranties={sortedPendingWarranties.map((entry) => ({ ...entry, billBackChecked: entry.billBackDate?.getTime() === today.getTime() }))}
            purchases={stockSheet.purchases}
            labDeadEntries={stockSheet.labDeadEntries}
            billBackPaisa={stockSheet.billBackPaisa}
            deadOutQuantity={stockSheet.deadOutQuantity}
            totalSalesPaisa={totalSalesPaisa}
            showSectionNav={false}
            showOverall={false}
            returnToEntries
          />
        </div>
      </div>
      <footer className="sheet-page-foot"><span>BITS STOCK REPORTING</span><Link href={`/sheets/${dateKey}`}>OPEN TODAY’S STOCK SHEET <span aria-hidden="true">↗</span></Link></footer>
    </main>
  );
}
