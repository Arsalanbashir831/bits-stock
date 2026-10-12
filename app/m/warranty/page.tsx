import { addWarrantyInEntry } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { sortPartyEntries } from "@/lib/party-sort";
import { activeProducts, formatPaisa, partyNames, portalNotice } from "@/app/m/shared";
import { PortalTabs } from "@/app/m/portal-tabs";

export const runtime = "nodejs";

export default async function EmployeeWarrantyInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const [sheet, products, parties] = await Promise.all([
    prisma.stockSheet.findUnique({
      where: { sheetDate: today },
      include: { warrantyIns: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    activeProducts(),
    partyNames(),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";
  const warrantyIns = sortPartyEntries(sheet?.warrantyIns ?? []);

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Warranty in · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Add warranty in</h1>
        <p>One drive per entry. It joins today’s stock and appears in pending warranty from tomorrow.</p>
      </div>

      <PortalTabs current="/m/warranty" tabs={[{ href: "/m/warranty", label: "Warranty in" }, { href: "/m/warranty/out", label: "Warranty out" }]} />

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice error">Today’s stock sheet is closed. New entries are locked.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}

      <form className="m-card m-form" action={addWarrantyInEntry}>
        <input type="hidden" name="sheetDate" value={dateKey} />
        <input type="hidden" name="returnTo" value="/m/warranty" />
        <div className="m-field">
          <label htmlFor="m-wi-party">Party</label>
          <input id="m-wi-party" name="party" list="m-wi-party-options" required disabled={readOnly} autoComplete="off" placeholder="Choose or add a party" />
          <datalist id="m-wi-party-options">{parties.map((party) => <option key={party.name} value={party.name} />)}</datalist>
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-product">Item</label>
          <select id="m-wi-product" name="productId" required disabled={readOnly} defaultValue="">
            <option value="" disabled>Select an item</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-invoice">Invoice number</label>
          <input id="m-wi-invoice" name="invoiceNumber" required disabled={readOnly} autoComplete="off" placeholder="Invoice no." />
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-invoice-date">Date of invoice</label>
          <input id="m-wi-invoice-date" name="invoiceDate" type="date" required disabled={readOnly} />
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-rma">RMA number</label>
          <input id="m-wi-rma" name="rmaNumber" required disabled={readOnly} inputMode="numeric" autoComplete="off" placeholder="RMA no." />
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-amount">Pending amount · PKR</label>
          <input id="m-wi-amount" name="amount" type="number" min="0" step="0.01" required disabled={readOnly} placeholder="0.00" />
        </div>
        <div className="m-field">
          <label htmlFor="m-wi-status">Drive status</label>
          <select id="m-wi-status" name="driveStatus" required disabled={readOnly} defaultValue="FAULTY_FOR_LAB">
            <option value="FAULTY_FOR_LAB">Add to Faulty For Lab</option>
            <option value="OK">100% OK</option>
          </select>
        </div>
        <button className="m-submit" type="submit" disabled={readOnly}>Save warranty in</button>
      </form>

      <div className="m-card">
        <div className="m-card-title"><span>Today’s warranty in</span><span className="m-kicker">{String(sheet?.warrantyIns.length ?? 0).padStart(2, "0")}</span></div>
        {warrantyIns.length ? (
          <div className="m-rows">
            {warrantyIns.map((entry) => (
              <div className="m-row" key={entry.id}>
                <div className="m-row-main">
                  <strong>{entry.party}</strong>
                  <span>{entry.itemName} · RMA {entry.rmaNumber} · INV {entry.invoiceNumber}</span>
                  {entry.driveStatus === "FAULTY_FOR_LAB" && <span className="m-tag is-faulty">FAULTY FOR LAB</span>}
                </div>
                <span className="m-row-value">{formatPaisa(entry.amountPaisa)}</span>
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No warranty drives received today yet.</div>}
      </div>
    </>
  );
}
