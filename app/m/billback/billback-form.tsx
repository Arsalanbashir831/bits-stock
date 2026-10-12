"use client";

import { useState } from "react";
import { setPendingWarrantyBillBackCheck } from "@/app/actions/stock-sheets";

function formatPaisa(paisa: number) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(paisa / 100);
}

type BillBackClaim = {
  id: string;
  party: string;
  itemName: string;
  receivedDate: string;
  quantity: number;
  invoiceDate: string;
  invoiceNumber: string;
  rmaNumber: string;
  amountPaisa: number;
  source: string;
};

export default function BillBackForm({ claims, dateKey }: { claims: BillBackClaim[]; dateKey: string }) {
  const [selectedId, setSelectedId] = useState("");
  const selected = claims.find((claim) => claim.id === selectedId);

  if (!claims.length) {
    return <div className="m-empty">No open warranty claims are available for bill back today.</div>;
  }

  return (
    <form action={setPendingWarrantyBillBackCheck} className="m-form">
      <input type="hidden" name="sheetDate" value={dateKey} />
      <input type="hidden" name="returnTo" value="/m/billback" />
      <div className="m-card">
        <div className="m-field">
          <label htmlFor="billback-claim">Warranty IN or Pending Warranty</label>
          <select id="billback-claim" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Select a claim</option>
            {claims.map((claim) => (
              <option key={claim.id} value={claim.id}>
                {claim.source} · {claim.party} · RMA {claim.rmaNumber} · {claim.itemName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <>
          <input type="hidden" name="pendingWarrantyId" value={selected.id} />
          <input type="hidden" name="billBackChecked" value="true" />
          <section className="m-card" aria-live="polite">
            <div className="m-card-title">
              <span>{selected.itemName}</span>
              <span className="m-kicker">{selected.source}</span>
            </div>
            <div className="m-detail-grid">
              <div><span>Party</span><strong>{selected.party}</strong></div>
              <div><span>RMA</span><strong>{selected.rmaNumber}</strong></div>
              <div><span>Invoice</span><strong>{selected.invoiceNumber || "Not recorded"}</strong></div>
              <div><span>Invoice date</span><strong>{selected.invoiceDate}</strong></div>
              <div><span>Received</span><strong>{selected.receivedDate}</strong></div>
              <div><span>Quantity</span><strong>{selected.quantity}</strong></div>
              <div><span>Amount</span><strong>PKR {formatPaisa(selected.amountPaisa)}</strong></div>
            </div>
          </section>
          <button className="m-submit" type="submit">Mark bill back today</button>
        </>
      )}
    </form>
  );
}
