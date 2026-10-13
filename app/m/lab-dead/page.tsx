import { addLabDeadEntries, deleteLabDeadEntry, editLabDeadEntry } from "@/app/actions/stock-sheets";
import { activeProducts, portalNotice } from "@/app/m/shared";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function EmployeeLabDeadPage({
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
      include: {
        lines: {
          where: { faultyForLab: { gt: 0 } },
          orderBy: { itemName: "asc" },
          select: { productId: true, itemName: true, faultyForLab: true },
        },
        labDeadEntries: {
          orderBy: { createdAt: "desc" },
          include: { product: { select: { id: true, name: true } } },
        },
      },
    }),
    activeProducts(),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Lab disposal · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Lab Dead Out</h1>
        <p>Tick each faulty item you are sending to the lab, then enter how many units to send.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice error">Today’s stock sheet is closed. New entries are locked.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}

      <form className="m-card m-form" action={addLabDeadEntries}>
        <input type="hidden" name="sheetDate" value={dateKey} />
        <input type="hidden" name="returnTo" value="/m/lab-dead" />
        <div className="m-field">
          <span className="m-field-label">Choose items to send</span>
          <span className="m-hint">Select one or more items. Set a quantity for each selected item.</span>
          {sheet?.lines.length ? (
            <div className="m-checklist">
              {sheet.lines.map((line) => (
                <div className="m-check-row" key={line.productId}>
                  <label className="m-check-item">
                    <input type="checkbox" name="productIds" value={line.productId} required disabled={readOnly} />
                    <span className="m-check-copy"><strong>{line.itemName}</strong><small>Faulty for lab</small></span>
                  </label>
                  <span className="m-available-count">{line.faultyForLab} available</span>
                  <label className="m-check-quantity">
                    <span>Quantity</span>
                    <input name={`quantity_${line.productId}`} type="number" min="1" max={line.faultyForLab} step="1" defaultValue="1" aria-label={`Quantity of ${line.itemName} sent as lab dead`} disabled={readOnly} />
                  </label>
                </div>
              ))}
            </div>
          ) : <div className="m-empty">No faulty-for-lab stock is available today.</div>}
        </div>
        <button className="m-submit" type="submit" disabled={readOnly || !sheet?.lines.length}>Save lab dead out</button>
      </form>

      <div className="m-card">
        <div className="m-card-title"><span>Today’s lab dead out</span><span className="m-kicker">{String(sheet?.labDeadEntries.length ?? 0).padStart(2, "0")}</span></div>
        {sheet?.labDeadEntries.length ? (
          <div className="m-rows">
            {sheet.labDeadEntries.map((entry) => (
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main"><strong>{entry.product.name}</strong><span>{formatSheetDate(entry.createdAt, { hour: "2-digit", minute: "2-digit" })}</span></div>
                  <span className="m-row-value">−{entry.quantity}</span>
                </div>
                {!readOnly && <details className="m-entry-edit">
                  <summary>Edit or delete</summary>
                  <form className="m-form m-edit-form" action={editLabDeadEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/lab-dead" />
                    <input type="hidden" name="labDeadId" value={entry.id} />
                    <div className="m-field"><label htmlFor={`lab-dead-product-${entry.id}`}>Faulty product</label><select id={`lab-dead-product-${entry.id}`} name="productId" required defaultValue={entry.productId}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
                    <div className="m-field"><label htmlFor={`lab-dead-quantity-${entry.id}`}>Quantity sent as lab dead</label><input id={`lab-dead-quantity-${entry.id}`} name="quantity" type="number" min="1" step="1" required defaultValue={entry.quantity} /></div>
                    <button className="m-submit" type="submit">Save changes</button>
                  </form>
                  <DeleteEntryForm action={deleteLabDeadEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/lab-dead" />
                    <input type="hidden" name="labDeadId" value={entry.id} />
                    <button className="m-delete-button" type="submit">Delete lab dead out</button>
                  </DeleteEntryForm>
                </details>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No lab-dead units recorded today.</div>}
      </div>
    </>
  );
}
