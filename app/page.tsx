import Link from "next/link";
import { addProduct, createTodayStockSheet } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, getPreviousBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";

export const runtime = "nodejs";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.25 10h11.5m-4.75-4.75L15.75 10 11 14.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.25v11.5M4.25 10h11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const dateKey = getBusinessDateKey();
  const todayDate = toSheetDate(dateKey);
  const previousDateKey = getPreviousBusinessDateKey();
  const [today, history, productCount, pendingCount, previousSheet, params] = await Promise.all([
    prisma.stockSheet.findUnique({
      where: { sheetDate: todayDate },
      include: { _count: { select: { lines: true, invoices: true, warrantyIns: true, warrantyOuts: true, purchases: true, labDeadEntries: true } } },
    }),
    prisma.stockSheet.findMany({
      where: { status: "CLOSED" },
      orderBy: { sheetDate: "desc" },
      take: 45,
      include: { _count: { select: { lines: true } } },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.pendingWarrantyEntry.count({ where: { resolvedDate: null, billBackDate: null } }),
    prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(previousDateKey) }, select: { id: true, status: true } }),
    searchParams,
  ]);
  const todayHref = `/sheets/${dateKey}`;
  const todayClosed = today?.status === "CLOSED";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/" aria-label="Bits Stock home">
          <span className="brand-mark">B</span>
          <span className="brand-wordmark">BITS<span>STOCK</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className="side-nav-link active" href="/">
            <span className="nav-glyph sheet-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
            <span>Stock sheets</span>
            <span className="nav-count">{history.length}</span>
          </Link>
          <Link className="side-nav-link" href="/entries">
            <span className="nav-glyph entries-glyph" aria-hidden="true"><i /><i /><i /></span>
            <span>Today’s entries</span>
          </Link>
          <Link className="side-nav-link" href="/m">
            <span className="nav-glyph entries-glyph" aria-hidden="true"><i /><i /><i /></span>
            <span>Employee portal</span>
          </Link>
          <Link className="side-nav-link" href="/backup">
            <span className="nav-glyph box-glyph" aria-hidden="true" />
            <span>Backup & restore</span>
          </Link>
        </nav>

        <div className="sidebar-rule" />
        <div className="sidebar-date-label">TODAY’S REPORT</div>
        <div className={`sidebar-status ${today ? "is-ready" : "is-missing"}`}>
          <span className="status-dot" />
          <span>{today ? "Created for today" : "Not created yet"}</span>
        </div>
        <div className="sidebar-date">{formatSheetDate(new Date(), { weekday: "long" })}</div>
        <div className="sidebar-date-number">{formatSheetDate(new Date(), { day: "2-digit", month: "long" })}</div>

        <div className="sidebar-bottom">
          <div className="sidebar-bottom-rule" />
          <span className="live-indicator"><i /> LOCAL STOCKBOOK</span>
          <span className="sidebar-version">DAILY RECORDS · v1.0</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><b>/</b><strong>STOCK SHEETS</strong></div>
          <div className="topbar-right">
            <span className="today-chip"><span className="today-chip-dot" />{formatSheetDate(new Date(), { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
            <span className="user-mark" aria-label="BITS Stock">BS</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-rule" />DAILY STOCK CONTROL <span className="eyebrow-index">/ 01</span></div>
              <h1>Stock sheets<span className="heading-period">.</span></h1>
              <p className="page-description">Open today’s sheet, record work, and review yesterday’s corrections.</p>
            </div>
            <form action={createTodayStockSheet}>
              <button className="primary-button" type="submit" disabled={Boolean(today)}>
                <PlusIcon />
                <span>{today ? "Today’s report created" : "Create today’s report"}</span>
                {!today && <kbd>↵</kbd>}
              </button>
            </form>
          </div>

          {params["product-added"] && <div className="notice success-notice">Item added to your inventory list.</div>}
          {params.error === "product-name" && <div className="notice error-notice">Enter an item name to continue.</div>}

          <section className={`today-panel ${today ? "today-panel-ready" : ""}`} aria-labelledby="today-heading">
            <div className="today-panel-main">
              <div className="panel-kicker"><span className={`panel-status-mark ${today ? "ready" : "pending"}`} />TODAY’S STOCK REPORT</div>
              <h2 id="today-heading">{today ? (todayClosed ? "Today’s report is closed." : "Today’s report is open.") : "Start today’s stock record."}</h2>
              <p>{today ? (todayClosed ? "Saved in daily history. You can still correct today’s entries." : "Add today’s entries, then close the report to save it in history.") : "Create a dated snapshot to begin the daily stock record."}</p>
            </div>
            <div className="today-panel-side">
              <div className="today-panel-date">{formatSheetDate(new Date(), { day: "2-digit", month: undefined, year: undefined })}<span>{formatSheetDate(new Date(), { month: "short", year: "numeric", day: undefined })}</span></div>
              {today ? (
                <Link className="text-link" href={todayHref}>Open today’s sheet <ArrowIcon /></Link>
              ) : (
                <form action={createTodayStockSheet}>
                  <button className="panel-create-button" type="submit">Create report <ArrowIcon /></button>
                </form>
              )}
            </div>
            <div className="panel-index">01</div>
          </section>

          <section className="dashboard-work" aria-label="Stock management shortcuts">
            <div className="dashboard-work-heading">
              <div><span className="section-kicker">TODAY AT A GLANCE</span><h2>Manage the day</h2></div>
              <span className="dashboard-work-date">{formatSheetDate(todayDate, { weekday: "long", day: "2-digit", month: "long" })}</span>
            </div>
            <div className="dashboard-metrics">
              <div><span>Stock items</span><strong>{productCount}</strong></div>
              <div><span>Entries today</span><strong>{today ? today._count.invoices + today._count.warrantyIns + today._count.warrantyOuts + today._count.purchases + today._count.labDeadEntries : 0}</strong></div>
              <div><span>Pending warranty</span><strong>{pendingCount}</strong></div>
            </div>
            <div className="dashboard-actions">
              {today ? <Link href={todayHref}><strong>Open stock sheet</strong><span>Review balances and close today’s report →</span></Link> : <form action={createTodayStockSheet}><button type="submit"><strong>Create today’s sheet</strong><span>Start the daily stock record →</span></button></form>}
              <Link href="/entries"><strong>Manage today’s entries</strong><span>Add, check, and correct records →</span></Link>
              {previousSheet && <Link href={`/sheets/${previousDateKey}`}><strong>Correct previous stock day</strong><span>Edit yesterday’s recorded entries →</span></Link>}
              <Link href="/backup"><strong>Backup & restore</strong><span>Download or import the full database →</span></Link>
            </div>
          </section>

          <div className="content-grid">
            <section className="history-section" aria-labelledby="history-heading">
              <div className="section-heading-row">
                <div>
                  <div className="section-kicker">ARCHIVE</div>
                  <h2 id="history-heading">Daily history <span>{history.length.toString().padStart(2, "0")}</span></h2>
                </div>
                <span className="history-range">LATEST RECORDS <i /></span>
              </div>

              {history.length ? (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th scope="col">REPORT DATE</th>
                        <th scope="col">ITEMS IN SHEET</th>
                        <th scope="col">STATUS</th>
                        <th scope="col"><span className="sr-only">Open report</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((sheet, index) => {
                        const key = sheet.sheetDate.toISOString().slice(0, 10);
                        const isToday = key === dateKey;
                        return (
                          <tr key={sheet.id} className={isToday ? "history-row today-history-row" : "history-row"}>
                            <td>
                              <Link className="history-date-link" href={`/sheets/${key}`}>
                                <span className="history-index">{String(history.length - index).padStart(2, "0")}</span>
                                <span>{formatSheetDate(sheet.sheetDate, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
                                {isToday && <span className="today-tag">TODAY</span>}
                              </Link>
                            </td>
                            <td className="history-item-count">{String(sheet._count.lines).padStart(2, "0")} <span>items</span></td>
                            <td><span className="saved-status"><i />CLOSED</span></td>
                            <td className="history-open-cell"><Link className="history-open" href={`/sheets/${key}`} aria-label={`Open stock sheet for ${formatSheetDate(sheet.sheetDate)}`}><ArrowIcon /></Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="history-footer"><span>SHOWING {String(history.length).padStart(2, "0")} RECENT DAILY SHEETS</span><span>LOCAL ARCHIVE <b>●</b></span></div>
                </div>
              ) : (
                <div className="empty-history">
                  <span className="empty-history-mark">—</span>
                  <div><strong>No closed reports yet</strong><p>Close a daily stock sheet to add it to history.</p></div>
                </div>
              )}
            </section>

            <aside className="inventory-card" id="inventory">
              <div className="inventory-card-head"><span className="section-kicker">CATALOG</span><span className="catalog-index">02</span></div>
              <div className="catalog-count">{String(productCount).padStart(2, "0")}</div>
              <h2>Stock items</h2>
              <p>Active items included when a new daily sheet is created.</p>
              <details className="add-item-details">
                <summary><PlusIcon /> Add a new item</summary>
                <form className="add-item-form" action={addProduct}>
                  <label htmlFor="item-name">ITEM NAME</label>
                  <input id="item-name" name="name" placeholder="e.g. DT 2TB" required />
                  <label htmlFor="item-sku">SKU <span>OPTIONAL</span></label>
                  <input id="item-sku" name="sku" placeholder="Generated if blank" />
                  <label htmlFor="item-category">SECTION</label>
                  <select id="item-category" name="category" defaultValue="Other">
                    <option>Desktop Drives</option>
                    <option>Laptop Drives</option>
                    <option>Solid State Drives</option>
                    <option>Accessories</option>
                    <option>Other</option>
                  </select>
                  <button className="add-item-submit" type="submit">Save item <ArrowIcon /></button>
                </form>
              </details>
              <div className="catalog-card-foot"><span>PRODUCT LIST</span><span>ACTIVE</span></div>
            </aside>
          </div>

          <footer className="page-footer"><span>BITS STOCK REPORTING</span><span>DAILY SNAPSHOTS <i /> HISTORY PRESERVED</span></footer>
        </div>
      </section>
    </main>
  );
}
