import { prisma } from "@/lib/prisma";
import { formatSheetDate, getBusinessDateKey, toSheetDate } from "@/lib/stock-sheet-date";
import { sortPartyEntries } from "@/lib/party-sort";
import { portalNotice } from "@/app/m/shared";
import { PortalTabs } from "@/app/m/portal-tabs";
import { WarrantyOutForm } from "@/app/m/warranty/out/warranty-out-form";
import { deleteWarrantyOutEntry, editWarrantyOutEntry } from "@/app/actions/stock-sheets";
import { DeleteEntryForm } from "@/app/m/delete-entry-form";

export const runtime = "nodejs";

export default async function EmployeeWarrantyOutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const [sheet, pendingClaims] = await Promise.all([
    prisma.stockSheet.findUnique({
      where: { sheetDate: today },
      include: { warrantyOuts: { orderBy: { createdAt: "desc" }, include: { pendingWarrantyEntry: { select: { id: true, rmaNumber: true } } } } },
    }),
    prisma.pendingWarrantyEntry.findMany({
      where: {
        receivedDate: { lte: today },
        stockSheet: { sheetDate: { lte: today } },
        AND: [
          { OR: [{ billBackDate: null }, { billBackDate: { gt: today } }] },
          { OR: [{ resolvedDate: null }, { resolvedDate: { gt: today } }] },
        ],
      },
      include: { sourceWarrantyIn: { select: { id: true } } },
    }).then(sortPartyEntries),
  ]);

  const notice = portalNotice(query);
  const readOnly = !sheet || sheet.status !== "OPEN";
  const warrantyOuts = sortPartyEntries(sheet?.warrantyOuts ?? []);

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Warranty out · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Add warranty out</h1>
        <p>Replace a drive against a pending claim or a Warranty IN received today. It clears the claim and reduces quantity in hand.</p>
      </div>

      <PortalTabs current="/m/warranty/out" tabs={[{ href: "/m/warranty", label: "Warranty in" }, { href: "/m/warranty/out", label: "Warranty out" }]} />

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      {readOnly && sheet && <div className="m-notice">Today’s sheet is closed. You can edit a saved entry below, but cannot add or delete one.</div>}
      {!sheet && <div className="m-notice error">No stock sheet for today yet. Ask the office to create it first.</div>}

      <WarrantyOutForm
        dateKey={dateKey}
        disabled={readOnly}
        claims={pendingClaims.map((claim) => ({
          id: claim.id,
          rmaNumber: claim.rmaNumber,
          label: `${claim.sourceWarrantyIn && claim.receivedDate.getTime() === today.getTime() ? "WARRANTY IN TODAY" : "PENDING WARRANTY"} · ${claim.party} · ${claim.itemName} · RMA ${claim.rmaNumber} · received ${formatSheetDate(claim.receivedDate, { day: "2-digit", month: "short" })}`,
        }))}
      />

      <div className="m-card">
        <div className="m-card-title"><span>Today’s warranty out</span><span className="m-kicker">{String(sheet?.warrantyOuts.length ?? 0).padStart(2, "0")}</span></div>
        {warrantyOuts.length ? (
          <div className="m-rows">
            {warrantyOuts.map((entry) => (
              <div className="m-record" key={entry.id}>
                <div className="m-row">
                  <div className="m-row-main">
                    <strong>{entry.party}</strong>
                    <span>{entry.itemName} · slip {entry.rmaSlipNumber} · RMA {entry.pendingWarrantyEntry?.rmaNumber ?? "—"}</span>
                  </div>
                </div>
                {sheet && <details className="m-entry-edit">
                  <summary>Edit entry</summary>
                  {entry.pendingWarrantyEntry && <form className="m-form m-edit-form" action={editWarrantyOutEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/warranty/out" />
                    <input type="hidden" name="warrantyOutId" value={entry.id} />
                    <input type="hidden" name="pendingWarrantyId" value={entry.pendingWarrantyEntry.id} />
                    <div className="m-field"><label htmlFor={`wo-slip-${entry.id}`}>RMA slip number</label><input id={`wo-slip-${entry.id}`} name="rmaSlipNumber" required defaultValue={entry.rmaSlipNumber} /></div>
                    <button className="m-submit" type="submit">Save changes</button>
                  </form>}
                  {!readOnly && <DeleteEntryForm action={deleteWarrantyOutEntry}>
                    <input type="hidden" name="sheetDate" value={dateKey} />
                    <input type="hidden" name="returnTo" value="/m/warranty/out" />
                    <input type="hidden" name="warrantyOutId" value={entry.id} />
                    <button className="m-delete-button" type="submit">Delete warranty out</button>
                  </DeleteEntryForm>}
                </details>}
              </div>
            ))}
          </div>
        ) : <div className="m-empty">No drives replaced today yet.</div>}
      </div>

      <div className="m-notice">Claims received today appear here tomorrow.</div>
    </>
  );
}
