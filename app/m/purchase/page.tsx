import { addPurchaseEntry, deletePurchaseEntry, editPurchaseEntry } from "@/app/actions/stock-sheets";
import { activeProducts, partyNames, portalNotice } from "@/app/m/shared";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function EmployeePurchasePage({
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
      include: {
        purchases: {
          orderBy: { createdAt: "desc" },
          include: { product: { select: { id: true, name: true } } },
        },
      },
    }),
    activeProducts(),
    partyNames(),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Purchase entry · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Record a purchase</h1>
        <p>Enter the item, supplier/party, and quantity received. Purchases increase stock in hand.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice">Today&apos;s sheet is closed. You can edit a saved purchase below, but cannot add or delete one.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}

      <form className="m-card m-form" action={addPurchaseEntry}>
        <input type="hidden" name="sheetDate" value={dateKey} />
        <input type="hidden" name="returnTo" value="/m/purchase" />
        <div className="m-field">
          <label htmlFor="m-purchase-product">Item</label>
          <select id="m-purchase-product" name="productId" required disabled={readOnly} defaultValue="">
            <option value="" disabled>Select an item</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
        <div className="m-field">
          <label htmlFor="m-purchase-party">Supplier / party</label>
          <input
            id="m-purchase-party"
            name="party"
            list="m-purchase-party-list"
            autoComplete="off"
            required
            disabled={readOnly}
            placeholder="Choose or add a party"
          />
          <datalist id="m-purchase-party-list">
            {parties.map((p) => <option key={p.name} value={p.name} />)}
          </datalist>
        </div>
        <div className="m-field">
          <label htmlFor="m-purchase-quantity">Quantity</label>
          <input id="m-purchase-quantity" name="quantity" type="number" min="1" step="1" required disabled={readOnly} defaultValue="1" />
        </div>
        <button className="m-submit" type="submit" disabled={readOnly}>Save purchase</button>
      </form>

      <div className="m-card">
        <div className="m-card-title">
          <span>Today&apos;s purchases · tap to fix a mistake</span>
          <span className="m-kicker">{String(sheet?.purchases.length ?? 0).padStart(2, "0")}</span>
        </div>
        {sheet?.purchases.length ? (
          <div className="m-rows">
            {sheet.purchases.map((entry) => (
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main">
                    <strong>{entry.product.name}</strong>
                    <span>{entry.party} · qty {entry.quantity}</span>
                  </div>
                  <span className="m-row-value">+{entry.quantity}</span>
                </div>
                {sheet && <details className="m-entry-edit">
                  <summary>Edit entry</summary>
                  <form className="m-form m-edit-form" action={editPurchaseEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/purchase" />
                    <input type="hidden" name="purchaseId" value={entry.id} />
                    <div className="m-field">
                      <label htmlFor={`purchase-product-${entry.id}`}>Item</label>
                      <select id={`purchase-product-${entry.id}`} name="productId" required defaultValue={entry.productId}>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                    </div>
                    <div className="m-field">
                      <label htmlFor={`purchase-party-${entry.id}`}>Supplier / party</label>
                      <input
                        id={`purchase-party-${entry.id}`}
                        name="party"
                        list={`purchase-party-list-${entry.id}`}
                        autoComplete="off"
                        required
                        defaultValue={entry.party}
                      />
                      <datalist id={`purchase-party-list-${entry.id}`}>
                        {parties.map((p) => <option key={p.name} value={p.name} />)}
                      </datalist>
                    </div>
                    <div className="m-field">
                      <label htmlFor={`purchase-quantity-${entry.id}`}>Quantity</label>
                      <input id={`purchase-quantity-${entry.id}`} name="quantity" type="number" min="1" step="1" required defaultValue={entry.quantity} />
                    </div>
                    <button className="m-submit" type="submit">Save changes</button>
                  </form>
                  {!readOnly && <DeleteEntryForm action={deletePurchaseEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/purchase" />
                    <input type="hidden" name="purchaseId" value={entry.id} />
                    <button className="m-delete-button" type="submit">Delete purchase</button>
                  </DeleteEntryForm>}
                </details>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No purchases recorded today yet.</div>}
      </div>
    </>
  );
}
