import { closeStockSheet, prepareStockSheetClosing } from "@/app/actions/stock-sheets";
import { formatSheetDate } from "@/lib/stock-sheet-date";

export function CloseStockSheet({ dateKey, status, closedAt, closingPreparedAt, returnToEntries = false }: {
  dateKey: string;
  status: string;
  closedAt: Date | null;
  closingPreparedAt: Date | null;
  returnToEntries?: boolean;
}) {
  if (status === "CLOSED") {
    return <span className="sheet-closed-status"><i />Closed{closedAt ? ` · ${formatSheetDate(closedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span>;
  }

  const action = closingPreparedAt ? closeStockSheet : prepareStockSheetClosing;
  return (
    <div className={`close-sheet-controls${closingPreparedAt ? " is-prepared" : ""}`}>
      {closingPreparedAt && <p className="close-sheet-review-note">Closing quantities are ready in CLSG QTY. Review the report before confirming.</p>}
      <form action={action}>
        <input type="hidden" name="sheetDate" value={dateKey} />
        {returnToEntries && <input type="hidden" name="returnTo" value="/entries" />}
        <button type="submit">{closingPreparedAt ? "Confirm closing" : (returnToEntries ? "Close today’s sheet" : "Close stock sheet")} <span aria-hidden="true">↗</span></button>
      </form>
    </div>
  );
}
