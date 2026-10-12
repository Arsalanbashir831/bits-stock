import { addInvoiceEntry } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { activeProducts, formatPaisa, portalNotice } from "@/app/m/shared";

export const runtime = "nodejs";

export default async function EmployeeSalePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const [sheet, products] = await Promise.all([
    prisma.stockSheet.findUnique({
      where: { sheetDate: today },
      include: { invoices: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    activeProducts(),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Sale entry · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Add invoice / sale</h1>
        <p>Each sale reduces the item’s quantity in hand on today’s sheet.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice error">Today’s stock sheet is closed. New entries are locked.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}

      <form className="m-card m-form" action={addInvoiceEntry}>
        <input type="hidden" name="sheetDate" value={dateKey} />
        <input type="hidden" name="returnTo" value="/m/sale" />
        <div className="m-field">
          <label htmlFor="m-sale-product">Item</label>
          <select id="m-sale-product" name="productId" required disabled={readOnly} defaultValue="">
            <option value="" disabled>Select an item</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
        <div className="m-field">
          <label htmlFor="m-sale-invoice">Invoice number</label>
          <input id="m-sale-invoice" name="invoiceNumber" required disabled={readOnly} inputMode="numeric" autoComplete="off" placeholder="e.g. 10245" />
        </div>
        <div className="m-field">
          <label htmlFor="m-sale-quantity">Quantity</label>
          <input id="m-sale-quantity" name="quantity" type="number" min="1" step="1" required disabled={readOnly} defaultValue="1" />
        </div>
        <div className="m-field">
          <label htmlFor="m-sale-price">Price per unit · PKR</label>
          <input id="m-sale-price" name="price" type="number" min="0" step="0.01" required disabled={readOnly} placeholder="0.00" />
        </div>
        <button className="m-submit" type="submit" disabled={readOnly}>Save sale</button>
      </form>

      <div className="m-card">
        <div className="m-card-title"><span>Today’s sales</span><span className="m-kicker">{String(sheet?.invoices.length ?? 0).padStart(2, "0")}</span></div>
        {sheet?.invoices.length ? (
          <div className="m-rows">
            {sheet.invoices.map((entry) => (
              <div className="m-row" key={entry.id}>
                <div className="m-row-main">
                  <strong>{entry.itemName}</strong>
                  <span>INV {entry.invoiceNumber} · {entry.quantity} × {formatPaisa(entry.pricePaisa)}</span>
                </div>
                <span className="m-row-value">{formatPaisa(entry.quantity * entry.pricePaisa)}</span>
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No sales recorded today yet.</div>}
      </div>
    </>
  );
}
