import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";

export async function recalculateProduct(productId: string, tx: Prisma.TransactionClient) {
  const [sheets, purchases, invoices, warrantyIns, warrantyOuts, labDeadEntries, pendingClaims] = await Promise.all([
    tx.stockSheet.findMany({ where: { lines: { some: { productId } } }, orderBy: { sheetDate: "asc" }, include: { lines: { where: { productId } } } }),
    tx.purchaseEntry.findMany({ where: { productId }, select: { stockSheetId: true, quantity: true } }),
    tx.invoiceEntry.findMany({ where: { productId }, select: { stockSheetId: true, quantity: true } }),
    tx.warrantyInEntry.findMany({ where: { productId }, select: { stockSheetId: true, driveStatus: true, quantity: true } }),
    tx.warrantyOutEntry.findMany({ where: { productId }, select: { stockSheetId: true, pendingWarrantyEntry: { select: { quantity: true } } } }),
    tx.labDeadEntry.findMany({ where: { productId }, select: { stockSheetId: true, quantity: true } }),
    tx.pendingWarrantyEntry.findMany({ where: { productId }, select: { stockSheet: { select: { sheetDate: true } }, receivedDate: true, quantity: true, resolvedDate: true, billBackDate: true } }),
  ]);
  const sumFor = (rows: Array<{ stockSheetId: string; quantity: number }>, sheetId: string) => rows.reduce((sum, row) => sum + (row.stockSheetId === sheetId ? row.quantity : 0), 0);
  const warrantyInFor = (sheetId: string) => warrantyIns.reduce((sum, row) => sum + (row.stockSheetId === sheetId ? row.quantity : 0), 0);
  const faultyInFor = (sheetId: string) => warrantyIns.reduce((sum, row) => sum + (row.stockSheetId === sheetId && row.driveStatus === "FAULTY_FOR_LAB" ? row.quantity : 0), 0);
  const warrantyOutFor = (sheetId: string) => warrantyOuts.reduce((sum, row) => sum + (row.stockSheetId === sheetId ? row.pendingWarrantyEntry?.quantity ?? 1 : 0), 0);
  let previousClosing = sheets[0]?.lines[0]?.openingQtyInHand ?? 0;
  let previousFaulty = sheets[0]?.lines[0]?.openingFaultyForLab ?? 0;
  let isFirst = true;
  const updatedLines: Array<Record<string, number | string>> = [];

  // Opening counts only claims received before the day; the closing balance already includes same-day receives.
  const pendingCountFor = (sheetDate: Date, carried: boolean) => pendingClaims.reduce((sum, claim) => {
    const received = carried ? claim.receivedDate < sheetDate : claim.receivedDate <= sheetDate;
    const inScope = claim.stockSheet.sheetDate <= sheetDate && received;
    const unresolved = claim.resolvedDate === null || (carried ? claim.resolvedDate >= sheetDate : claim.resolvedDate > sheetDate);
    const notBillBacked = claim.billBackDate === null || (carried ? claim.billBackDate >= sheetDate : claim.billBackDate > sheetDate);
    return sum + (inScope && unresolved && notBillBacked ? claim.quantity : 0);
  }, 0);

  for (const sheet of sheets) {
    const line = sheet.lines[0];
    if (!line) continue;
    const openingQtyInHand = isFirst ? line.openingQtyInHand : previousClosing;
    const openingFaultyForLab = isFirst ? line.openingFaultyForLab : previousFaulty;
    const openingPw = pendingCountFor(sheet.sheetDate, true);
    const purchase = sumFor(purchases, sheet.id);
    const sale = sumFor(invoices, sheet.id);
    const warrantyIn = warrantyInFor(sheet.id);
    const warrantyOut = warrantyOutFor(sheet.id);
    const labDead = sumFor(labDeadEntries, sheet.id);
    const pendingWarranty = pendingCountFor(sheet.sheetDate, false);
    const faultyForLab = Math.max(0, openingFaultyForLab + faultyInFor(sheet.id) - labDead);
    const closingQtyInHand = openingQtyInHand + purchase + warrantyIn - sale - warrantyOut;

    updatedLines.push({ id: line.id, openingQtyInHand, openingPw, openingFaultyForLab, purchase, warrantyIn, sale, warrantyOut, labDead, faultyForLab, pendingWarranty, closingQtyInHand });
    previousClosing = closingQtyInHand;
    previousFaulty = faultyForLab;
    isFirst = false;
  }

  // One update per batch keeps long stock histories inside the transaction timeout.
  for (let offset = 0; offset < updatedLines.length; offset += 500) {
    const batch = updatedLines.slice(offset, offset + 500);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "StockSheetLine" AS line SET
        "openingQtyInHand" = data."openingQtyInHand",
        "openingPw" = data."openingPw",
        "openingFaultyForLab" = data."openingFaultyForLab",
        "purchase" = data."purchase",
        "warrantyIn" = data."warrantyIn",
        "sale" = data."sale",
        "warrantyOut" = data."warrantyOut",
        "labDead" = data."labDead",
        "faultyForLab" = data."faultyForLab",
        "pendingWarranty" = data."pendingWarranty",
        "closingQtyInHand" = data."closingQtyInHand"
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS data(
        "id" text, "openingQtyInHand" integer, "openingPw" integer,
        "openingFaultyForLab" integer, "purchase" integer, "warrantyIn" integer,
        "sale" integer, "warrantyOut" integer, "labDead" integer,
        "faultyForLab" integer, "pendingWarranty" integer, "closingQtyInHand" integer
      )
      WHERE line."id" = data."id"
    `);
  }
}

export async function recalculateDeadOutQuantity(stockSheetId: string, tx: Prisma.TransactionClient) {
  const [total, sheet] = await Promise.all([
    tx.labDeadEntry.aggregate({ where: { stockSheetId }, _sum: { quantity: true } }),
    tx.stockSheet.findUnique({ where: { id: stockSheetId }, select: { id: true } }),
  ]);
  if (sheet) await tx.stockSheet.update({ where: { id: sheet.id }, data: { deadOutQuantity: total._sum.quantity ?? 0 } });
}

export async function recalculateBillBackTotal(sheetDate: Date, tx: Prisma.TransactionClient) {
  const [entries, sheet] = await Promise.all([
    tx.pendingWarrantyEntry.findMany({ where: { billBackDate: sheetDate }, select: { amountPaisa: true } }),
    tx.stockSheet.findUnique({ where: { sheetDate }, select: { id: true } }),
  ]);
  if (sheet) await tx.stockSheet.update({ where: { id: sheet.id }, data: { billBackPaisa: entries.reduce((sum, entry) => sum + entry.amountPaisa, 0) } });
}

export async function recalculateSheetClosing(stockSheetId: string, sheetDate: Date, tx: Prisma.TransactionClient) {
  const lines = await tx.stockSheetLine.findMany({ where: { stockSheetId }, select: { productId: true } });
  for (const line of lines) await recalculateProduct(line.productId, tx);
  await recalculateDeadOutQuantity(stockSheetId, tx);
  await recalculateBillBackTotal(sheetDate, tx);
}

