import { addWarrantyInEntry, deleteWarrantyInEntry, editWarrantyInEntry } from "@/app/actions/stock-sheets";
import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { sortPartyEntries } from "@/lib/party-sort";
import { activeProducts, formatPaisa, partyNames, portalNotice } from "@/app/m/shared";
import { PortalTabs } from "@/app/m/portal-tabs";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";

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
      include: { warrantyIns: { orderBy: { createdAt: "desc" } } },
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
          <label htmlFor="m-wi-quantity">Quantity</label>
          <input id="m-wi-quantity" name="quantity" type="number" min="1" step="1" required disabled={readOnly} defaultValue={1} />
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
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main">
                    <strong>{entry.party}</strong>
                    <span>{entry.itemName} · Qty {entry.quantity} · RMA {entry.rmaNumber} · INV {entry.invoiceNumber}</span>
                    {entry.driveStatus === "FAULTY_FOR_LAB" && <span className="m-tag is-faulty">FAULTY FOR LAB</span>}
                  </div>
                  <span className="m-row-value">{formatPaisa(entry.amountPaisa)}</span>
                </div>
                {!readOnly && <details className="m-entry-edit">
                  <summary>Edit or delete</summary>
                  <form className="m-form m-edit-form" action={editWarrantyInEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/warranty" />
                    <input type="hidden" name="warrantyInId" value={entry.id} />
                    <div className="m-field"><label htmlFor={`wi-party-${entry.id}`}>Party</label><input id={`wi-party-${entry.id}`} name="party" list={`wi-parties-${entry.id}`} required defaultValue={entry.party} /><datalist id={`wi-parties-${entry.id}`}>{parties.map((party) => <option key={party.name} value={party.name} />)}</datalist></div>
                    <div className="m-field"><label htmlFor={`wi-product-${entry.id}`}>Item</label><select id={`wi-product-${entry.id}`} name="productId" required defaultValue={entry.productId}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
                    <div className="m-field"><label htmlFor={`wi-invoice-${entry.id}`}>Invoice number</label><input id={`wi-invoice-${entry.id}`} name="invoiceNumber" required defaultValue={entry.invoiceNumber} /></div>
                    <div className="m-field"><label htmlFor={`wi-invoice-date-${entry.id}`}>Date of invoice</label><input id={`wi-invoice-date-${entry.id}`} name="invoiceDate" type="date" required defaultValue={entry.invoiceDate.toISOString().slice(0, 10)} /></div>
                    <div className="m-field"><label htmlFor={`wi-rma-${entry.id}`}>RMA number</label><input id={`wi-rma-${entry.id}`} name="rmaNumber" required defaultValue={entry.rmaNumber} /></div>
                    <div className="m-field"><label htmlFor={`wi-quantity-${entry.id}`}>Quantity</label><input id={`wi-quantity-${entry.id}`} name="quantity" type="number" min="1" step="1" required defaultValue={entry.quantity} /></div>
                    <div className="m-field"><label htmlFor={`wi-amount-${entry.id}`}>Pending amount · PKR</label><input id={`wi-amount-${entry.id}`} name="amount" type="number" min="0" step="0.01" required defaultValue={(entry.amountPaisa / 100).toFixed(2)} /></div>
                    <div className="m-field"><label htmlFor={`wi-status-${entry.id}`}>Drive status</label><select id={`wi-status-${entry.id}`} name="driveStatus" required defaultValue={entry.driveStatus}><option value="FAULTY_FOR_LAB">Add to Faulty For Lab</option><option value="OK">100% OK</option></select></div>
                    <button className="m-submit" type="submit">Save changes</button>
                  </form>
                  <DeleteEntryForm action={deleteWarrantyInEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/warranty" />
                    <input type="hidden" name="warrantyInId" value={entry.id} />
                    <button className="m-delete-button" type="submit">Delete warranty in</button>
                  </DeleteEntryForm>
                </details>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No warranty drives received today yet.</div>}
      </div>
    </>
  );
}
