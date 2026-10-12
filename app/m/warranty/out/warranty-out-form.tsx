"use client";

import { useState } from "react";
import { addWarrantyOutEntry } from "@/app/actions/stock-sheets";

type ClaimOption = { id: string; label: string; rmaNumber: string };

export function WarrantyOutForm({ claims, dateKey, disabled }: { claims: ClaimOption[]; dateKey: string; disabled: boolean }) {
  const [selectedId, setSelectedId] = useState("");
  const claim = claims.find((option) => option.id === selectedId) ?? null;

  return (
    <form className="m-card m-form" action={addWarrantyOutEntry}>
      <input type="hidden" name="sheetDate" value={dateKey} />
      <input type="hidden" name="returnTo" value="/m/warranty/out" />
      <div className="m-field">
        <label htmlFor="m-wo-claim">Pending warranty or today’s Warranty IN</label>
        <select
          id="m-wo-claim"
          name="pendingWarrantyId"
          required
          disabled={disabled || !claims.length}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="" disabled>{claims.length ? "Select a warranty claim" : "No open warranty claims today"}</option>
          {claims.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>
      <div className="m-field">
        <label htmlFor="m-wo-slip">RMA slip number</label>
        <input id="m-wo-slip" name="rmaSlipNumber" required readOnly value={claim?.rmaNumber ?? ""} placeholder="Fills from the claim" />
        <span className="m-hint">Taken from the selected claim’s RMA number.</span>
      </div>
      <button className="m-submit" type="submit" disabled={disabled || !claims.length}>Save warranty out</button>
    </form>
  );
}
