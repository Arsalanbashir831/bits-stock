import {
  addInvoiceEntry,
  addLabDeadEntry,
  addPendingWarrantyEntry,
  addPurchaseEntry,
  addWarrantyInEntry,
  addWarrantyOutEntry,
  deleteInvoiceEntry,
  deleteLabDeadEntry,
  deletePendingWarrantyEntry,
  deletePurchaseEntry,
  deleteWarrantyInEntry,
  deleteWarrantyOutEntry,
  editInvoiceEntry,
  editLabDeadEntry,
  editPendingWarrantyEntry,
  editPurchaseEntry,
  editWarrantyInEntry,
  editWarrantyOutEntry,
  setPendingWarrantyBillBackCheck,
} from "@/app/actions/stock-sheets";
import { formatSheetDate } from "@/lib/stock-sheet-date";

type ProductOption = { id: string; name: string };
type PartyOption = { name: string };
type InvoiceRow = { id: string; productId: string; invoiceNumber: string; itemName: string; quantity: number; pricePaisa: number };
type WarrantyInRow = { id: string; productId: string; party: string; itemName: string; invoiceNumber: string; invoiceDate: Date; rmaNumber: string; driveStatus: string; amountPaisa: number };
type WarrantyOutRow = { id: string; party: string; itemName: string; rmaSlipNumber: string; pendingWarrantyEntryId: string | null; pendingWarrantyEntry: { rmaNumber: string } | null };
type PendingWarrantyRow = { id: string; productId: string; itemName: string; party: string; receivedDate: Date; quantity: number; invoiceDate: Date; rmaNumber: string; amountPaisa: number; billBackChecked: boolean };
type QuantityEntry = { id: string; productId: string; quantity: number; product: { name: string } };
type PurchaseRow = { id: string; productId: string; quantity: number; party: string; product: { name: string } };

const money = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateOptions = { day: "2-digit", month: "short", year: "numeric" } as const;

function formatMoney(paisa: number) {
  return money.format(paisa / 100);
}

function Field({ label, name, type = "text", required = true, placeholder, step, min, defaultValue }: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  defaultValue?: string | number;
}) {
  return (
    <label className="entry-field">
      <span>{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} step={step} min={min} defaultValue={defaultValue} />
    </label>
  );
}

function ProductField({ products, defaultValue = "" }: { products: ProductOption[]; defaultValue?: string }) {
  return (
    <label className="entry-field">
      <span>ITEM</span>
      <select name="productId" required defaultValue={defaultValue}>
        <option value="" disabled>Select item</option>
        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
    </label>
  );
}

function PartyField({ parties, listId, defaultValue = "" }: { parties: PartyOption[]; listId: string; defaultValue?: string }) {
  return (
    <label className="entry-field">
      <span>PARTY</span>
      <input name="party" list={listId} autoComplete="off" required placeholder="Choose or add a party" defaultValue={defaultValue} />
      <datalist id={listId}>{parties.map((party) => <option key={party.name} value={party.name} />)}</datalist>
    </label>
  );
}

function PendingClaimField({ pendingWarranties, defaultValue = "", current }: { pendingWarranties: PendingWarrantyRow[]; defaultValue?: string; current?: { id: string; rmaNumber: string } | null }) {
  const openClaims = pendingWarranties.filter((entry) => !entry.billBackChecked);
  const currentOption = current && !openClaims.some((entry) => entry.id === current.id) ? current : null;
  return (
    <label className="entry-field">
      <span>CLAIM RMA #</span>
      <select name="pendingWarrantyId" required defaultValue={defaultValue}>
        <option value="" disabled>Select pending claim</option>
        {currentOption && <option value={currentOption.id}>{currentOption.rmaNumber} · current claim</option>}
        {openClaims.map((entry) => <option key={entry.id} value={entry.id}>{entry.rmaNumber} · {entry.itemName} · {entry.party}</option>)}
      </select>
    </label>
  );
}

function RowActions({ readOnly, editOnly = false, dateKey, returnToEntries, editForm, deleteAction, idName, id, label }: {
  readOnly: boolean;
  editOnly?: boolean;
  dateKey: string;
  returnToEntries: boolean;
  editForm: React.ReactNode;
  deleteAction: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  label: string;
}) {
  return (
    <td data-label={readOnly ? "Status" : "Actions"}>
      {readOnly && !editOnly ? <span className="claim-status">Saved</span> :
      <div className="pending-row-actions">
        <details className="pending-edit-details">
          <summary>Edit</summary>
          {editForm}
        </details>
        {!readOnly && <form action={deleteAction} className="pending-delete-form"><EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} /><input type="hidden" name={idName} value={id} /><button type="submit" aria-label={`Delete ${label}`}>Delete</button></form>}
      </div>}
    </td>
  );
}

function AddEntry({ title, children, readOnly }: { title: string; children: React.ReactNode; readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <details className="entry-details">
      <summary><span className="entry-plus">+</span>{title}<span className="summary-arrow">↓</span></summary>
      <div className="entry-form-wrap">{children}</div>
    </details>
  );
}

function EntryFormContext({ dateKey, returnToEntries }: { dateKey: string; returnToEntries: boolean }) {
  return <><input type="hidden" name="sheetDate" value={dateKey} />{returnToEntries && <input type="hidden" name="returnTo" value="/entries" />}</>;
}

function TableEmpty({ children, columns }: { children: string; columns: number }) {
  return <tr className="entry-empty-row"><td colSpan={columns}>{children}</td></tr>;
}

export function DailyEntrySections({
  dateKey,
  products,
  parties,
  invoices,
  warrantyIns,
  warrantyOuts,
  pendingWarranties,
  purchases,
  labDeadEntries,
  billBackPaisa,
  deadOutQuantity,
  totalSalesPaisa,
  showSectionNav = true,
  showOverall = true,
  returnToEntries = false,
  readOnly = false,
  editOnly = false,
}: {
  dateKey: string;
  products: ProductOption[];
  parties: PartyOption[];
  invoices: InvoiceRow[];
  warrantyIns: WarrantyInRow[];
  warrantyOuts: WarrantyOutRow[];
  pendingWarranties: PendingWarrantyRow[];
  purchases: PurchaseRow[];
  labDeadEntries: QuantityEntry[];
  billBackPaisa: number;
  deadOutQuantity: number;
  totalSalesPaisa: number;
  showSectionNav?: boolean;
  showOverall?: boolean;
  returnToEntries?: boolean;
  readOnly?: boolean;
  editOnly?: boolean;
}) {
  const openPendingCount = pendingWarranties.filter((entry) => !entry.billBackChecked).length;
  return (
    <div className="daily-entry-area">
      {showSectionNav && <nav className="report-section-nav" aria-label="Daily entry sections">
        <a href="#invoices">Invoices <span>{String(invoices.length).padStart(2, "2")}</span></a>
        <a href="#purchases">Purchases</a>
        <a href="#today-warranty-in">Warranty in <span>{String(warrantyIns.length).padStart(2, "2")}</span></a>
        <a href="#today-warranty-out">Warranty out <span>{String(warrantyOuts.length).padStart(2, "2")}</span></a>
        <a href="#pending-warranty">Pending warranty <span>{String(openPendingCount).padStart(2, "2")}</span></a>
        <a href="#lab-dead">Lab dead</a>
        <a href="#overall">Overall</a>
      </nav>}

      {showOverall && <section className="overall-section" id="overall">
        <div className="entries-section-heading">
          <div><div className="section-kicker">DAY SUMMARY</div><h2>Overall <span>01</span></h2></div>
          <span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span>
        </div>
        <div className="overall-cards">
          <div className="overall-card"><span>TODAY BILL BACK</span><strong>{formatMoney(billBackPaisa)}</strong><i>PKR · FROM CHECKED CLAIMS</i></div>
          <div className="overall-card"><span>TODAY DEAD OUT</span><strong>{deadOutQuantity.toLocaleString("en-PK")}</strong><i>UNITS · LAB DEAD ENTRIES</i></div>
          <div className="overall-card sales-total-card"><span>TOTAL SALES</span><strong>{formatMoney(totalSalesPaisa)}</strong><i>QTY × PRICE / UNIT</i></div>
        </div>
      </section>}

      <section className="entry-section" id="purchases">
        <div className="entries-section-heading"><div><div className="section-kicker">IN · STOCK</div><h2>Purchases <span>{String(purchases.length).padStart(2, "2")}</span></h2></div><span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span></div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>PARTY</th><th>ITEM</th><th>QTY.</th><th>ACTIONS</th></tr></thead><tbody>
            {purchases.length ? purchases.map((entry) => <tr key={entry.id}>
              <td data-label="Party">{entry.party}</td><td data-label="Item">{entry.product.name}</td><td data-label="Quantity">{entry.quantity}</td>
              <RowActions readOnly={readOnly} editOnly={editOnly} dateKey={dateKey} returnToEntries={returnToEntries} deleteAction={deletePurchaseEntry} idName="purchaseId" id={entry.id} label={`purchase of ${entry.product.name}`}
                editForm={<form className="pending-edit-form" action={editPurchaseEntry}>
                  <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                  <input type="hidden" name="purchaseId" value={entry.id} />
                  <PartyField parties={parties} listId={`purchase-edit-party-${entry.id}`} defaultValue={entry.party} />
                  <ProductField products={products} defaultValue={entry.productId} />
                  <Field label="QTY." name="quantity" type="number" min="1" step="1" defaultValue={entry.quantity} />
                  <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                </form>} />
            </tr>) : <TableEmpty columns={4}>No purchases entered for this date.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add purchase entry" readOnly={readOnly}><form className="entry-form" action={addPurchaseEntry}><EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} /><PartyField parties={parties} listId="purchase-party-options" /><ProductField products={products} /><Field label="QTY." name="quantity" type="number" min="1" step="1" placeholder="1" /><button className="entry-submit" type="submit">Save purchase <span>↗</span></button></form></AddEntry>
        </div>
      </section>

      <section className="entry-section" id="invoices">
        <div className="entries-section-heading">
          <div><div className="section-kicker">OUT · SALES</div><h2>Invoices <span>{String(invoices.length).padStart(2, "2")}</span></h2></div>
          <span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span>
        </div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>INVOICE NUMBER</th><th>ITEM SOLD</th><th>QTY.</th><th>PRICE / UNIT</th><th>DATE</th><th>ACTIONS</th></tr></thead><tbody>
            {invoices.length ? invoices.map((entry) => <tr key={entry.id}>
              <td data-label="Invoice number" className="entry-ref">{entry.invoiceNumber}</td><td data-label="Item sold">{entry.itemName}</td><td data-label="Quantity">{entry.quantity}</td><td data-label="Price / unit">{formatMoney(entry.pricePaisa)}</td><td data-label="Date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</td>
              <RowActions readOnly={readOnly} editOnly={editOnly} dateKey={dateKey} returnToEntries={returnToEntries} deleteAction={deleteInvoiceEntry} idName="invoiceId" id={entry.id} label={`invoice ${entry.invoiceNumber}`}
                editForm={<form className="pending-edit-form" action={editInvoiceEntry}>
                  <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                  <input type="hidden" name="invoiceId" value={entry.id} />
                  <Field label="INVOICE NUMBER" name="invoiceNumber" defaultValue={entry.invoiceNumber} />
                  <ProductField products={products} defaultValue={entry.productId} />
                  <Field label="QTY." name="quantity" type="number" min="1" step="1" defaultValue={entry.quantity} />
                  <Field label="PRICE / UNIT · PKR" name="price" type="number" min="0" step="0.01" defaultValue={(entry.pricePaisa / 100).toFixed(2)} />
                  <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                </form>} />
            </tr>) : <TableEmpty columns={6}>No invoices entered for this date.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add invoice entry" readOnly={readOnly}>
            <form className="entry-form" action={addInvoiceEntry}>
              <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
              <Field label="INVOICE NUMBER" name="invoiceNumber" placeholder="Invoice no." />
              <ProductField products={products} />
              <Field label="QTY." name="quantity" type="number" min="1" step="1" placeholder="1" />
              <Field label="PRICE / UNIT · PKR" name="price" type="number" min="0" step="0.01" placeholder="0.00" />
              <button className="entry-submit" type="submit">Save invoice <span>↗</span></button>
            </form>
          </AddEntry>
        </div>
      </section>

      <section className="entry-section" id="today-warranty-in">
        <div className="entries-section-heading">
          <div><div className="section-kicker">IN · SERVICE</div><h2>Today warranty in <span>{String(warrantyIns.length).padStart(2, "2")}</span></h2></div>
          <span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span>
        </div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>PARTY</th><th>ITEM</th><th>INV. NO.</th><th>DATE OF INV.</th><th>RMA #</th><th>DRIVE STATUS</th><th>PENDING AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>
            {warrantyIns.length ? warrantyIns.map((entry) => <tr key={entry.id}>
              <td data-label="Party">{entry.party}</td><td data-label="Item">{entry.itemName}</td><td data-label="Invoice number" className="entry-ref">{entry.invoiceNumber}</td><td data-label="Invoice date">{formatSheetDate(entry.invoiceDate, dateOptions)}</td><td data-label="RMA number" className="entry-ref">{entry.rmaNumber}</td><td data-label="Drive status"><span className={`entry-status ${entry.driveStatus === "OK" ? "is-ok" : "is-faulty"}`}>{entry.driveStatus === "OK" ? "100% OK" : "Add to Faulty For Lab"}</span></td><td data-label="Pending amount">{formatMoney(entry.amountPaisa)}</td>
              <RowActions readOnly={readOnly} editOnly={editOnly} dateKey={dateKey} returnToEntries={returnToEntries} deleteAction={deleteWarrantyInEntry} idName="warrantyInId" id={entry.id} label={`warranty in ${entry.rmaNumber}`}
                editForm={<form className="pending-edit-form" action={editWarrantyInEntry}>
                  <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                  <input type="hidden" name="warrantyInId" value={entry.id} />
                  <PartyField parties={parties} listId={`warranty-in-edit-party-${entry.id}`} defaultValue={entry.party} />
                  <ProductField products={products} defaultValue={entry.productId} />
                  <Field label="INVOICE NUMBER" name="invoiceNumber" defaultValue={entry.invoiceNumber} />
                  <Field label="DATE OF INVOICE" name="invoiceDate" type="date" defaultValue={entry.invoiceDate.toISOString().slice(0, 10)} />
                  <Field label="RMA #" name="rmaNumber" defaultValue={entry.rmaNumber} />
                  <Field label="PENDING AMOUNT · PKR" name="amount" type="number" min="0" step="0.01" defaultValue={(entry.amountPaisa / 100).toFixed(2)} />
                  <label className="entry-field"><span>DRIVE STATUS</span><select name="driveStatus" required defaultValue={entry.driveStatus}><option value="OK">100% OK</option><option value="FAULTY_FOR_LAB">Add to Faulty For Lab</option></select></label>
                  <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                </form>} />
            </tr>) : <TableEmpty columns={8}>No warranty items received today.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add warranty in entry" readOnly={readOnly}>
            <form className="entry-form" action={addWarrantyInEntry}>
              <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
              <PartyField parties={parties} listId="warranty-in-party-options" />
              <ProductField products={products} />
              <Field label="INVOICE NUMBER" name="invoiceNumber" placeholder="Invoice no." />
              <Field label="DATE OF INVOICE" name="invoiceDate" type="date" />
              <Field label="RMA #" name="rmaNumber" placeholder="RMA number" />
              <Field label="PENDING AMOUNT · PKR" name="amount" type="number" min="0" step="0.01" placeholder="0.00" />
              <label className="entry-field"><span>DRIVE STATUS</span><select name="driveStatus" required defaultValue="OK"><option value="OK">100% OK</option><option value="FAULTY_FOR_LAB">Add to Faulty For Lab</option></select></label>
              <button className="entry-submit" type="submit">Save warranty in <span>↗</span></button>
            </form>
          </AddEntry>
        </div>
      </section>

      <section className="entry-section" id="today-warranty-out">
        <div className="entries-section-heading">
          <div><div className="section-kicker">OUT · SERVICE</div><h2>Warranty out <span>{String(warrantyOuts.length).padStart(2, "2")}</span></h2></div>
          <span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span>
        </div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>PARTY</th><th>ITEM</th><th>CLAIM RMA #</th><th>RMA SLIP #</th><th>DATE</th><th>ACTIONS</th></tr></thead><tbody>
            {warrantyOuts.length ? warrantyOuts.map((entry) => <tr key={entry.id}>
              <td data-label="Party">{entry.party}</td><td data-label="Item">{entry.itemName}</td><td data-label="Claim RMA" className="entry-ref">{entry.pendingWarrantyEntry?.rmaNumber ?? ""}</td><td data-label="RMA slip" className="entry-ref">{entry.rmaSlipNumber}</td><td data-label="Date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</td>
              <RowActions readOnly={readOnly} editOnly={editOnly} dateKey={dateKey} returnToEntries={returnToEntries} deleteAction={deleteWarrantyOutEntry} idName="warrantyOutId" id={entry.id} label={`warranty out slip ${entry.rmaSlipNumber}`}
                editForm={<form className="pending-edit-form" action={editWarrantyOutEntry}>
                  <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                  <input type="hidden" name="warrantyOutId" value={entry.id} />
                  <PendingClaimField pendingWarranties={pendingWarranties} defaultValue={entry.pendingWarrantyEntryId ?? ""} current={entry.pendingWarrantyEntryId ? { id: entry.pendingWarrantyEntryId, rmaNumber: entry.pendingWarrantyEntry?.rmaNumber ?? "" } : null} />
                  <Field label="RMA SLIP #" name="rmaSlipNumber" defaultValue={entry.rmaSlipNumber} />
                  <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                </form>} />
            </tr>) : <TableEmpty columns={6}>No warranty items sent out today.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add warranty out entry" readOnly={readOnly}>
            <form className="entry-form" action={addWarrantyOutEntry}>
              <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
              <PendingClaimField pendingWarranties={pendingWarranties} />
              <Field label="RMA SLIP #" name="rmaSlipNumber" placeholder="RMA slip no." />
              <button className="entry-submit" type="submit">Save warranty out <span>↗</span></button>
            </form>
          </AddEntry>
        </div>
      </section>

      <section className="entry-section" id="lab-dead">
        <div className="entries-section-heading"><div><div className="section-kicker">OUT · LAB DISPOSAL</div><h2>Lab dead <span>{String(labDeadEntries.length).padStart(2, "2")}</span></h2></div><span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span></div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>ITEM</th><th>QTY.</th><th>ACTIONS</th></tr></thead><tbody>
            {labDeadEntries.length ? labDeadEntries.map((entry) => <tr key={entry.id}>
              <td data-label="Item">{entry.product.name}</td><td data-label="Quantity">{entry.quantity}</td>
              <RowActions readOnly={readOnly} editOnly={editOnly} dateKey={dateKey} returnToEntries={returnToEntries} deleteAction={deleteLabDeadEntry} idName="labDeadId" id={entry.id} label={`lab dead ${entry.product.name}`}
                editForm={<form className="pending-edit-form" action={editLabDeadEntry}>
                  <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                  <input type="hidden" name="labDeadId" value={entry.id} />
                  <ProductField products={products} defaultValue={entry.productId} />
                  <Field label="QTY." name="quantity" type="number" min="1" step="1" defaultValue={entry.quantity} />
                  <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                </form>} />
            </tr>) : <TableEmpty columns={3}>No lab-dead units entered for this date.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add lab-dead entry" readOnly={readOnly}><form className="entry-form" action={addLabDeadEntry}><EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} /><ProductField products={products} /><Field label="QTY." name="quantity" type="number" min="1" step="1" placeholder="1" /><button className="entry-submit" type="submit">Save lab dead <span>↗</span></button></form></AddEntry>
        </div>
      </section>

      <section className="entry-section pending-section" id="pending-warranty">
        <div className="entries-section-heading">
          <div><div className="section-kicker">OPEN · FOLLOW-UP</div><h2>Pending warranty <span>{String(openPendingCount).padStart(2, "2")}</span></h2></div>
          <span className="entry-section-date">{formatSheetDate(new Date(`${dateKey}T00:00:00.000Z`), dateOptions)}</span>
        </div>
        <div className="entry-table-card">
          <div className="entry-table-scroll"><table className="entry-table"><thead><tr><th>ITEM</th><th>PARTY</th><th>RECEIVED DATE</th><th>QTY.</th><th>INV. DATE</th><th>RMA #</th><th>AMOUNT</th><th>BILL BACK CHECK</th></tr></thead><tbody>
            {pendingWarranties.length ? pendingWarranties.map((entry) => <tr key={entry.id}>
              <td data-label="Item">{entry.itemName}</td><td data-label="Party">{entry.party}</td><td data-label="Received date">{formatSheetDate(entry.receivedDate, dateOptions)}</td><td data-label="Quantity">{entry.quantity}</td><td data-label="Invoice date">{formatSheetDate(entry.invoiceDate, dateOptions)}</td><td data-label="RMA number" className="entry-ref">{entry.rmaNumber}</td><td data-label="Amount">{formatMoney(entry.amountPaisa)}</td>
              <td data-label={readOnly ? "Status" : "Actions"}>
                {readOnly && !editOnly ? <span className={`claim-status ${entry.billBackChecked ? "is-checked" : ""}`}>{entry.billBackChecked ? "Bill back checked" : "Pending"}</span> :
                <div className="pending-row-actions">
                  {!readOnly && <form action={setPendingWarrantyBillBackCheck} className="billback-check-form"><EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} /><input type="hidden" name="pendingWarrantyId" value={entry.id} /><label><input type="checkbox" name="billBackChecked" value="true" defaultChecked={entry.billBackChecked} /><span>Bill back</span></label><button type="submit">Save</button></form>}
                  <details className="pending-edit-details">
                    <summary>Edit</summary>
                    <form className="pending-edit-form" action={editPendingWarrantyEntry}>
                      <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
                      <input type="hidden" name="pendingWarrantyId" value={entry.id} />
                      <ProductField products={products} defaultValue={entry.productId} />
                      <PartyField parties={parties} listId={`pending-party-options-${entry.id}`} defaultValue={entry.party} />
                      <Field label="RECEIVED DATE" name="receivedDate" type="date" defaultValue={entry.receivedDate.toISOString().slice(0, 10)} />
                      <Field label="QTY." name="quantity" type="number" min="1" step="1" defaultValue={entry.quantity} />
                      <Field label="INVOICE DATE" name="invoiceDate" type="date" defaultValue={entry.invoiceDate.toISOString().slice(0, 10)} />
                      <Field label="RMA #" name="rmaNumber" placeholder="RMA number" defaultValue={entry.rmaNumber} />
                      <Field label="AMOUNT · PKR" name="amount" type="number" min="0" step="0.01" defaultValue={(entry.amountPaisa / 100).toFixed(2)} />
                      <button className="entry-submit" type="submit">Save changes <span>↗</span></button>
                    </form>
                  </details>
                  <form action={deletePendingWarrantyEntry} className="pending-delete-form"><EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} /><input type="hidden" name="pendingWarrantyId" value={entry.id} /><button type="submit" aria-label={`Delete pending warranty ${entry.rmaNumber}`}>Delete</button></form>
                </div>
                }
              </td>
            </tr>) : <TableEmpty columns={8}>No pending warranty entries for this date.</TableEmpty>}
          </tbody></table></div>
          <AddEntry title="Add pending warranty entry" readOnly={readOnly}>
            <form className="entry-form" action={addPendingWarrantyEntry}>
              <EntryFormContext dateKey={dateKey} returnToEntries={returnToEntries} />
              <ProductField products={products} />
              <PartyField parties={parties} listId="pending-party-options" />
              <Field label="RECEIVED DATE" name="receivedDate" type="date" />
              <Field label="QTY." name="quantity" type="number" min="1" step="1" placeholder="1" />
              <Field label="INVOICE DATE" name="invoiceDate" type="date" />
              <Field label="RMA #" name="rmaNumber" placeholder="RMA number" />
              <Field label="AMOUNT · PKR" name="amount" type="number" min="0" step="0.01" placeholder="0.00" />
              <button className="entry-submit" type="submit">Save pending warranty <span>↗</span></button>
            </form>
          </AddEntry>
        </div>
      </section>
    </div>
  );
}
