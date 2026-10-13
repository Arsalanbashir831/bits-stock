import Link from "next/link";
import { getBusinessDateKey, formatSheetDate, toSheetDate } from "@/lib/stock-sheet-date";
import { formatPaisa, openPendingClaims, portalNotice } from "@/app/m/shared";

export const runtime = "nodejs";

export default async function EmployeePendingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const claims = await openPendingClaims(today);

  const groups = new Map<string, typeof claims>();
  for (const claim of claims) {
    const list = groups.get(claim.party);
    if (list) list.push(claim);
    else groups.set(claim.party, [claim]);
  }
  const billBackTotalPaisa = claims
    .filter((claim) => claim.billBackDate?.getTime() === today.getTime())
    .reduce((sum, claim) => sum + claim.amountPaisa, 0);

  const notice = portalNotice(query);

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Pending warranty · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Pending warranty</h1>
        <p>{String(claims.length).padStart(2, "0")} open claim{claims.length === 1 ? "" : "s"} carried into today, across {groups.size} {groups.size === 1 ? "party" : "parties"}. Claims update automatically as warranty and bill back entries change.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}

      {claims.length ? (
        [...groups.entries()].map(([party, entries]) => (
          <div className="m-card" key={party}>
            <div className="m-card-title">
              <span>{party}</span>
              <span className="m-kicker">{String(entries.length).padStart(2, "0")}</span>
            </div>
            <div className="m-rows">
              {entries.map((entry) => (
                <div className="m-row" key={entry.id}>
                  <div className="m-row-main">
                    <strong>{entry.itemName}</strong>
                    <span>RMA {entry.rmaNumber} · received {formatSheetDate(entry.receivedDate, { day: "2-digit", month: "short" })} · qty {entry.quantity}</span>
                    {entry.billBackDate?.getTime() === today.getTime() && <span className="m-tag is-billback">BILL BACK TODAY</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : <div className="m-empty">No pending warranty carried into today.</div>}

      {billBackTotalPaisa > 0 && <div className="m-notice success">Bill back marked today · PKR {formatPaisa(billBackTotalPaisa)}</div>}

      <Link className="m-button m-secondary" href={`/api/sheets/${dateKey}/pdf`}><span>Download stock report</span><small>PDF</small></Link>
    </>
  );
}
