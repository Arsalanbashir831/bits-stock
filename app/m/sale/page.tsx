import { addInvoiceEntry, deleteInvoiceEntry, editInvoiceEntry } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { activeProducts, formatPaisa, portalNotice } from "@/app/m/shared";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";

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
      include: { invoices: { orderBy: { createdAt: "desc" } } },
    }),
    activeProducts(),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Sale entry · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Record a sale</h1>
        <p>Enter the invoice number, item, quantity, and price. The sale reduces stock in hand.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice">Today’s sheet is closed. You can edit a saved sale below, but cannot add or delete one.</div>}
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
        <div className="m-card-title"><span>Today’s sales · tap to fix a mistake</span><span className="m-kicker">{String(sheet?.invoices.length ?? 0).padStart(2, "0")}</span></div>
        {sheet?.invoices.length ? (
          <div className="m-rows">
            {sheet.invoices.map((entry) => (
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main">
                    <strong>{entry.itemName}</strong>
                    <span>INV {entry.invoiceNumber} · {entry.quantity} × {formatPaisa(entry.pricePaisa)}</span>
                  </div>
                  <span className="m-row-value">{formatPaisa(entry.quantity * entry.pricePaisa)}</span>
                </div>
                {sheet && <details className="m-entry-edit">
                  <summary>Edit entry</summary>
                  <form className="m-form m-edit-form" action={editInvoiceEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/sale" />
                    <input type="hidden" name="invoiceId" value={entry.id} />
                    <div className="m-field"><label htmlFor={`sale-product-${entry.id}`}>Item</label><select id={`sale-product-${entry.id}`} name="productId" required defaultValue={entry.productId}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
                    <div className="m-field"><label htmlFor={`sale-invoice-${entry.id}`}>Invoice number</label><input id={`sale-invoice-${entry.id}`} name="invoiceNumber" required defaultValue={entry.invoiceNumber} /></div>
                    <div className="m-field"><label htmlFor={`sale-quantity-${entry.id}`}>Quantity</label><input id={`sale-quantity-${entry.id}`} name="quantity" type="number" min="1" step="1" required defaultValue={entry.quantity} /></div>
                    <div className="m-field"><label htmlFor={`sale-price-${entry.id}`}>Price per unit · PKR</label><input id={`sale-price-${entry.id}`} name="price" type="number" min="0" step="0.01" required defaultValue={(entry.pricePaisa / 100).toFixed(2)} /></div>
                    <button className="m-submit" type="submit">Save changes</button>
                  </form>
                  {!readOnly && <DeleteEntryForm action={deleteInvoiceEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/sale" />
                    <input type="hidden" name="invoiceId" value={entry.id} />
                    <button className="m-delete-button" type="submit">Delete sale</button>
                  </DeleteEntryForm>}
                </details>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No sales recorded today yet.</div>}
      </div>
    </>
  );
}
