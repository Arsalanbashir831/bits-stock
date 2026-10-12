import { getBusinessDateKey, formatSheetDate, toSheetDate } from "@/lib/stock-sheet-date";
import { prisma } from "@/lib/prisma";
import { portalNotice } from "@/app/m/shared";
import BillBackForm from "./billback-form";

export const runtime = "nodejs";

export default async function EmployeeBillBackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const dateKey = getBusinessDateKey();
  const today = toSheetDate(dateKey);
  const entries = await prisma.pendingWarrantyEntry.findMany({
    where: {
      receivedDate: { lte: today },
      stockSheet: { sheetDate: { lte: today } },
      AND: [
        { OR: [{ resolvedDate: null }, { resolvedDate: { gt: today } }] },
        { OR: [{ billBackDate: null }, { billBackDate: { gt: today } }] },
      ],
    },
    include: {
      sourceWarrantyIn: {
        select: {
          invoiceNumber: true,
          invoiceDate: true,
          stockSheet: { select: { sheetDate: true } },
        },
      },
    },
    orderBy: [{ party: "asc" }, { receivedDate: "asc" }, { itemName: "asc" }],
  });
  const notice = portalNotice(query);
  const claims = entries.map((entry) => ({
    id: entry.id,
    party: entry.party,
    itemName: entry.itemName,
    receivedDate: formatSheetDate(entry.receivedDate, { day: "2-digit", month: "short", year: "numeric" }),
    quantity: entry.quantity,
    invoiceDate: formatSheetDate(entry.sourceWarrantyIn?.invoiceDate ?? entry.invoiceDate, { day: "2-digit", month: "short", year: "numeric" }),
    invoiceNumber: entry.sourceWarrantyIn?.invoiceNumber ?? "",
    rmaNumber: entry.rmaNumber,
    amountPaisa: entry.amountPaisa,
    source: entry.sourceWarrantyIn?.stockSheet.sheetDate.getTime() === today.getTime()
      ? "Warranty IN"
      : "Pending Warranty",
  }));

  return (
    <>
      <div className="m-head">
        <div className="m-kicker">Bill back · {formatSheetDate(today, { day: "2-digit", month: "short", year: "numeric" })}</div>
        <h1>Bill Back</h1>
        <p>Select an open Warranty IN or pending warranty claim to record its bill back today.</p>
      </div>

      {notice && <div className={`m-notice ${notice.tone}`}>{notice.text}</div>}
      <BillBackForm claims={claims} dateKey={dateKey} />
    </>
  );
}
