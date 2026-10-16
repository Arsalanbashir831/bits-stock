import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSheetDate } from "@/lib/stock-sheet-date";

export const runtime = "nodejs";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 20;
const sectionOrder = ["Desktop Drives", "Laptop Drives", "Solid State Drives", "Accessories", "Other"];

type DrawCommand = string;

function pdfText(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7e]/g, "?").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function money(paisa: number) {
  return (paisa / 100).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function pageCanvas() {
  const commands: DrawCommand[] = ["1 J 1 j", "0.35 w"];
  const y = (top: number) => PAGE_H - top;

  return {
    commands,
    rect(x: number, top: number, width: number, height: number, fill?: string) {
      if (fill) commands.push(`${fill} rg`);
      commands.push(`${x.toFixed(2)} ${(PAGE_H - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill ? "B" : "S"}`);
      if (fill) commands.push("0 0 0 rg");
    },
    line(x1: number, top1: number, x2: number, top2: number) {
      commands.push(`${x1.toFixed(2)} ${y(top1).toFixed(2)} m ${x2.toFixed(2)} ${y(top2).toFixed(2)} l S`);
    },
    text(value: unknown, x: number, top: number, size = 6, bold = false, align: "left" | "center" | "right" = "left", color = "0 0 0") {
      const str = pdfText(value);
      const approxWidth = str.length * size * (bold ? 0.54 : 0.5);
      const left = align === "center" ? x - approxWidth / 2 : align === "right" ? x - approxWidth : x;
      commands.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size.toFixed(2)} Tf 1 0 0 1 ${left.toFixed(2)} ${(PAGE_H - top - size).toFixed(2)} Tm (${str}) Tj ET 0 0 0 rg`);
    },
  };
}

type Canvas = ReturnType<typeof pageCanvas>;

function drawCell(canvas: Canvas, x: number, top: number, width: number, height: number, value: unknown, options: { fill?: string; bold?: boolean; size?: number; align?: "left" | "center" | "right"; color?: string } = {}) {
  if (options.fill) canvas.rect(x, top, width, height, options.fill);
  else canvas.rect(x, top, width, height);
  const left = options.align === "center" ? x + width / 2 : options.align === "right" ? x + width - 3 : x + 3;
  const lines = String(value ?? "").split("\n");
  const size = options.size ?? 5;
  const lineHeight = size * 1.05;
  const firstTop = top + Math.max(1, (height - lines.length * lineHeight) / 2);
  lines.forEach((line, index) => canvas.text(line, left, firstTop + index * lineHeight, size, options.bold ?? false, options.align ?? "left", options.color));
}

function drawStockSheet(sheet: {
  sheetDate: Date;
  id: string;
  status: string;
  closingPreparedAt: Date | null;
  lines: Array<{ id: string; itemName: string; sectionName: string | null; product: { sortOrder: number }; faultyForLab: number; pendingWarranty: number; closingQtyInHand: number; openingQtyInHand: number; openingPw: number; purchase: number; warrantyIn: number; sale: number; warrantyOut: number; labDead: number }>;
}) {
  const canvas = pageCanvas();
  const x = MARGIN;
  const width = PAGE_W - MARGIN * 2;
  const itemWidth = 122;
  const colWidth = (width - itemWidth) / 10;
  const cols = [itemWidth, ...Array.from({ length: 10 }, () => colWidth)];
  const fields = ["faultyForLab", "pendingWarranty", "closingQtyInHand", "openingQtyInHand", "openingPw", "purchase", "warrantyIn", "sale", "warrantyOut", "labDead"] as const;
  const showClosing = sheet.status === "CLOSED" || sheet.closingPreparedAt !== null;
  const ordered = [...sheet.lines].sort((a, b) => {
    const secA = a.sectionName ?? "Other";
    const secB = b.sectionName ?? "Other";
    return (sectionOrder.indexOf(secA) < 0 ? sectionOrder.length : sectionOrder.indexOf(secA)) - (sectionOrder.indexOf(secB) < 0 ? sectionOrder.length : sectionOrder.indexOf(secB)) || secA.localeCompare(secB) || a.product.sortOrder - b.product.sortOrder || a.itemName.localeCompare(b.itemName);
  });
  const groups = [...new Set(ordered.map((row) => row.sectionName ?? "Other"))].map((section) => ({ section, rows: ordered.filter((row) => (row.sectionName ?? "Other") === section) }));
  const nominal = 27 + 23 + 38 + groups.reduce((sum, group) => sum + group.rows.length * 15 + 31, 0) + 16;
  const scale = Math.min(1, (PAGE_H - 2 * MARGIN - 10) / nominal);
  let top = MARGIN;
  canvas.text("BITS STOCK REPORT", PAGE_W / 2, top, 12 * scale, true, "center");
  canvas.text(`DATED: ${dateLabel(sheet.sheetDate)}`, PAGE_W / 2, top + 14 * scale, 7 * scale, true, "center");
  top += 27 * scale;

  const groupHeight = 23 * scale;
  const subHeight = 38 * scale;
  const groupLabels = ["ITEMS", "CLSG QTY", "OPENING", "IN (Units)", "OUT (Units)"];
  const groupSpans = [1, 3, 2, 2, 3];
  let gx = x;
  let columnIndex = 0;
  groupLabels.forEach((label, index) => {
    const span = groupSpans[index];
    const w = cols.slice(columnIndex, columnIndex + span).reduce((a, b) => a + b, 0);
    drawCell(canvas, gx, top, w, groupHeight, label, { fill: index === 1 ? "0.96 0.91 0.00" : "0.92 0.92 0.90", bold: true, size: 6 * scale, align: "center" });
    gx += w;
    columnIndex += span;
  });
  top += groupHeight;
  const subHeaders = ["DETAIL", "Faulty\nfor lab", "Pending /\nwarranty", "Closing\nqty in hand", "Qty in\nhand", "PW", "Purch.", "Warranty\nin", "Sale", "Warranty\nout", "Lab\ndead"];
  let sx = x;
  subHeaders.forEach((label, index) => {
    drawCell(canvas, sx, top, cols[index], subHeight, label, { fill: index > 0 && index < 4 ? "1.00 0.99 0.88" : "0.98 0.98 0.96", bold: true, size: 5.5 * scale, align: index === 0 ? "left" : "center" });
    sx += cols[index];
  });
  top += subHeight;

  const totals = Object.fromEntries(fields.map((field) => [field, 0])) as Record<(typeof fields)[number], number>;
  for (const group of groups) {
    drawCell(canvas, x, top, width, 15 * scale, `${group.section.toUpperCase()}  |  ${group.rows.length} ITEMS`, { fill: "0.93 0.93 0.91", bold: true, size: 5.7 * scale });
    top += 15 * scale;
    const groupTotals = Object.fromEntries(fields.map((field) => [field, 0])) as typeof totals;
    for (const row of group.rows) {
      let rx = x;
      drawCell(canvas, rx, top, cols[0], 15 * scale, row.itemName, { size: 8 * scale, bold: true });
      rx += cols[0];
      fields.forEach((field, index) => {
        groupTotals[field] += row[field];
        totals[field] += row[field];
        const color = index === 0 ? "0.77 0.42 0.09" : index === 1 || index === 4 ? "0.16 0.38 0.65" : index >= 7 ? "0.70 0.23 0.21" : index >= 5 ? "0.15 0.44 0.27" : "0.08 0.09 0.07";
        drawCell(canvas, rx, top, cols[index + 1], 15 * scale, (!showClosing && index < 3) ? "" : row[field] || "", { size: 7.5 * scale, bold: true, align: "center", color });
        rx += cols[index + 1];
      });
      top += 15 * scale;
    }
    let tx = x;
    drawCell(canvas, tx, top, cols[0], 16 * scale, "TOTAL", { fill: "1.00 0.97 0.43", bold: true, size: 5.8 * scale });
    tx += cols[0];
    fields.forEach((field, index) => {
      drawCell(canvas, tx, top, cols[index + 1], 16 * scale, (!showClosing && index < 3) ? "" : groupTotals[field] || "", { fill: "1.00 0.97 0.43", bold: true, size: 5.4 * scale, align: "center" });
      tx += cols[index + 1];
    });
    top += 16 * scale;
  }
  let tx = x;
  drawCell(canvas, tx, top, cols[0], 16 * scale, "GRAND TOTAL", { fill: "0.96 0.91 0.00", bold: true, size: 6 * scale });
  tx += cols[0];
  fields.forEach((field, index) => {
    drawCell(canvas, tx, top, cols[index + 1], 16 * scale, (!showClosing && index < 3) ? "" : totals[field] || "", { fill: "0.96 0.91 0.00", bold: true, size: 5.5 * scale, align: "center" });
    tx += cols[index + 1];
  });
  return canvas.commands.join("\n");
}

function drawGrid(canvas: Canvas, x: number, top: number, width: number, headers: string[], rows: unknown[][], minRows: number, weights: number[], title: string, rowHeight: number, fontSize = 5) {
  const titleHeight = 17;
  const headHeight = 16;
  const colWidths = weights.map((weight) => width * weight / weights.reduce((sum, item) => sum + item, 0));
  drawCell(canvas, x, top, width, titleHeight, title, { fill: "0.92 0.92 0.90", bold: true, size: 6, align: "center" });
  top += titleHeight;
  let cx = x;
  headers.forEach((header, index) => {
    drawCell(canvas, cx, top, colWidths[index], headHeight, header, { fill: "0.97 0.97 0.95", bold: true, size: Math.min(5, fontSize), align: "center" });
    cx += colWidths[index];
  });
  top += headHeight;
  const count = Math.max(rows.length, minRows);
  for (let i = 0; i < count; i += 1) {
    cx = x;
    headers.forEach((_, index) => {
      drawCell(canvas, cx, top, colWidths[index], rowHeight, rows[i]?.[index] ?? "", { size: fontSize });
      cx += colWidths[index];
    });
    top += rowHeight;
  }
  return top;
}

function drawDailyEntries(sheet: {
  sheetDate: Date;
  invoices: Array<{ invoiceNumber: string; itemName: string; quantity: number; pricePaisa: number }>;
  warrantyIns: Array<{ party: string; itemName: string; invoiceNumber: string; invoiceDate: Date; rmaNumber: string; driveStatus: string; quantity: number; amountPaisa: number }>;
  warrantyOuts: Array<{ party: string; itemName: string; rmaSlipNumber: string; pendingWarrantyEntry: { rmaNumber: string; quantity: number } | null }>;
  pendingWarranties: Array<{ itemName: string; party: string; receivedDate: Date; quantity: number; invoiceDate: Date; rmaNumber: string; amountPaisa: number; billBackChecked: boolean }>;
  billBackPaisa: number;
  deadOutQuantity: number;
}, totalSalesPaisa: number) {
  const canvas = pageCanvas();
  const gap = 14;
  const fullWidth = PAGE_W - 2 * MARGIN;
  canvas.text("BITS STOCK REPORT", MARGIN, 17, 9, true);
  canvas.text(`DAILY ENTRIES  |  ${dateLabel(sheet.sheetDate)}`, PAGE_W - MARGIN, 18, 6, true, "right");
  canvas.line(MARGIN, 29, PAGE_W - MARGIN, 29);

  const half = (fullWidth - gap) / 2;
  const invoiceRows = sheet.invoices.map((row) => [row.invoiceNumber, row.itemName, row.quantity, money(row.pricePaisa)]);
  const warrantyOutRows = sheet.warrantyOuts.map((row) => [row.party, row.itemName, row.pendingWarrantyEntry?.quantity ?? 1, row.pendingWarrantyEntry?.rmaNumber ?? "", row.rmaSlipNumber]);
  const topAfterInvoices = drawGrid(canvas, MARGIN, 35, half, ["INVOICE #", "ITEM SOLD", "QTY", "PRICE"], invoiceRows, 11, [28, 38, 12, 22], "INVOICES", 14, 5.4);
  const topAfterOuts = drawGrid(canvas, MARGIN + half + gap, 35, half, ["PARTY", "ITEM", "QTY", "CLAIM RMA #", "RMA SLIP #"], warrantyOutRows, 11, [24, 23, 10, 20, 23], "WARRANTY OUT", 14, 5.2);
  const middleTop = Math.max(topAfterInvoices, topAfterOuts) + 9;
  const warrantyWidth = fullWidth * 0.72;
  const totalsWidth = fullWidth - warrantyWidth;
  const warrantyInRows = sheet.warrantyIns.map((row) => [row.party, row.itemName, row.quantity, row.invoiceNumber, dateLabel(row.invoiceDate), row.rmaNumber, row.driveStatus === "OK" ? "100% OK" : "FAULTY FOR LAB", money(row.amountPaisa)]);
  const warrantyEnd = drawGrid(canvas, MARGIN, middleTop, warrantyWidth, ["PARTY", "ITEM", "QTY", "INV #", "DATE", "RMA #", "DRIVE STATUS", "AMOUNT"], warrantyInRows, 8, [13, 15, 8, 11, 12, 10, 15, 16], "WARRANTY IN", 14, 4.3);
  const summaryRows = [
    ["TODAY BILL BACK", money(sheet.billBackPaisa)],
    ["TODAY DEAD OUT", sheet.deadOutQuantity || ""],
    ["TOTAL SALES", money(totalSalesPaisa)],
  ];
  const summaryX = MARGIN + warrantyWidth;
  const labelWidth = totalsWidth * 0.62;
  summaryRows.forEach(([label, value], index) => {
    const rowTop = middleTop + index * 21;
    drawCell(canvas, summaryX, rowTop, labelWidth, 21, label, { fill: index === 2 ? "0.96 0.91 0.00" : "0.95 0.95 0.93", bold: true, size: 5.2 });
    drawCell(canvas, summaryX + labelWidth, rowTop, totalsWidth - labelWidth, 21, value, { bold: true, size: 5.2 });
  });
  const summaryEnd = middleTop + summaryRows.length * 21;
  const pendingTop = Math.max(warrantyEnd, summaryEnd) + 10;
  const pendingHeaders = ["ITEM", "PARTY", "RECEIVED DATE", "QTY", "BILL DATE", "RMA #", "AMOUNT (RS)", "BILL BACK CHECK"];
  const pendingRows = sheet.pendingWarranties.map((row) => [row.itemName, row.party, dateLabel(row.receivedDate), row.quantity, dateLabel(row.invoiceDate), row.rmaNumber, money(row.amountPaisa), row.billBackChecked ? "X" : ""]);
  const pageBottom = PAGE_H - MARGIN;
  const desiredRows = Math.max(29, pendingRows.length);
  const pendingAvailable = pageBottom - pendingTop - 33;
  const pendingRowHeight = Math.max(8.5, Math.min(13, pendingAvailable / desiredRows));
  drawGrid(canvas, MARGIN, pendingTop, fullWidth, pendingHeaders, pendingRows, 29, [15, 13, 15, 6, 15, 10, 13, 13], "PENDING WARRANTY", pendingRowHeight, 4.8);
  return canvas.commands.join("\n");
}

type BillBackSlip = { party: string; entries: Array<{ itemName: string; rmaNumber: string; invoiceDate: Date; quantity: number; amountPaisa: number }> };

function drawPurchaseLabDeadBillBack(sheet: {
  sheetDate: Date;
  purchases: Array<{ party: string; quantity: number; product: { name: string } }>;
  labDeadEntries: Array<{ quantity: number; product: { name: string } }>;
}, slips: BillBackSlip[]) {
  const canvas = pageCanvas();
  const fullWidth = PAGE_W - 2 * MARGIN;
  canvas.text("BITS STOCK REPORT", MARGIN, 17, 9, true);
  canvas.text(`PURCHASES, LAB DEAD & BILL BACK  |  ${dateLabel(sheet.sheetDate)}`, PAGE_W - MARGIN, 18, 6, true, "right");
  canvas.line(MARGIN, 29, PAGE_W - MARGIN, 29);

  const purchaseRows = sheet.purchases.map((row) => [row.party, row.product.name, row.quantity]);
  const labDeadRows = sheet.labDeadEntries.map((row) => [row.product.name, row.quantity]);
  const purchaseRowCount = Math.max(purchaseRows.length, 4);
  const labDeadRowCount = Math.max(labDeadRows.length, 3);
  const slipParts = { title: 15, meta: 13, head: 13, row: 13, total: 15, gap: 10 };
  const slipNominal = slips.reduce((sum, slip) => sum + slipParts.title + slipParts.meta + slipParts.head + slip.entries.length * slipParts.row + slipParts.total + slipParts.gap, 0);
  const top = 38;
  const gridOverhead = 2 * (17 + 16) + 2 * 15 + 10;
  const rowHeight = Math.max(8.5, Math.min(13, (PAGE_H - MARGIN - top - gridOverhead - slipNominal) / (purchaseRowCount + labDeadRowCount)));
  const gridEnd = top + gridOverhead + (purchaseRowCount + labDeadRowCount) * rowHeight;
  const slipScale = slipNominal > 0 ? Math.min(1, Math.max(0.45, (PAGE_H - MARGIN - gridEnd - 6) / slipNominal)) : 1;

  const topAfterPurchases = drawGrid(canvas, MARGIN, top, fullWidth, ["PARTY", "ITEM", "QTY"], purchaseRows, 4, [26, 58, 16], "PURCHASES", rowHeight, 5.4);
  drawCell(canvas, MARGIN, topAfterPurchases, fullWidth, 15, `TOTAL PURCHASE UNITS  ${sheet.purchases.reduce((sum, row) => sum + row.quantity, 0)}`, { fill: "1.00 0.97 0.43", bold: true, size: 5.4 });
  const labDeadTop = topAfterPurchases + 15 + 10;
  const topAfterLabDead = drawGrid(canvas, MARGIN, labDeadTop, fullWidth, ["ITEM", "QTY"], labDeadRows, 3, [84, 16], "LAB DEAD", rowHeight, 5.4);
  drawCell(canvas, MARGIN, topAfterLabDead, fullWidth, 15, `TOTAL LAB DEAD UNITS  ${sheet.labDeadEntries.reduce((sum, row) => sum + row.quantity, 0)}`, { fill: "1.00 0.97 0.43", bold: true, size: 5.4 });

  const weights = [30, 18, 18, 8, 16];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const colWidths = weights.map((weight) => fullWidth * weight / weightSum);
  const headers = ["ITEM", "RMA #", "BILL DATE", "QTY", "AMOUNT (RS)"];
  let slipTop = gridEnd + 10;
  for (const slip of slips) {
    const titleHeight = slipParts.title * slipScale;
    drawCell(canvas, MARGIN, slipTop, fullWidth, titleHeight, "BILL BACK SLIP", { fill: "0.96 0.91 0.00", bold: true, size: 6 * slipScale, align: "center" });
    slipTop += titleHeight;
    const metaHeight = slipParts.meta * slipScale;
    drawCell(canvas, MARGIN, slipTop, fullWidth * 0.6, metaHeight, `PARTY: ${slip.party}`, { bold: true, size: 5.6 * slipScale });
    drawCell(canvas, MARGIN + fullWidth * 0.6, slipTop, fullWidth * 0.4, metaHeight, `DATED: ${dateLabel(sheet.sheetDate)}`, { bold: true, size: 5.6 * slipScale, align: "right" });
    slipTop += metaHeight;
    const headHeight = slipParts.head * slipScale;
    let cx = MARGIN;
    headers.forEach((header, index) => {
      drawCell(canvas, cx, slipTop, colWidths[index], headHeight, header, { fill: "0.97 0.97 0.95", bold: true, size: 5 * slipScale, align: "center" });
      cx += colWidths[index];
    });
    slipTop += headHeight;
    const rowSlipHeight = slipParts.row * slipScale;
    for (const entry of slip.entries) {
      const cells = [entry.itemName, entry.rmaNumber, dateLabel(entry.invoiceDate), entry.quantity, money(entry.amountPaisa)];
      cx = MARGIN;
      cells.forEach((value, index) => {
        drawCell(canvas, cx, slipTop, colWidths[index], rowSlipHeight, value, { size: 5.2 * slipScale, align: index === 4 ? "right" : index === 3 ? "center" : "left" });
        cx += colWidths[index];
      });
      slipTop += rowSlipHeight;
    }
    const totalHeight = slipParts.total * slipScale;
    drawCell(canvas, MARGIN, slipTop, fullWidth - colWidths[4], totalHeight, "TOTAL", { fill: "0.95 0.95 0.93", bold: true, size: 5.4 * slipScale });
    drawCell(canvas, MARGIN + fullWidth - colWidths[4], slipTop, colWidths[4], totalHeight, money(slip.entries.reduce((sum, entry) => sum + entry.amountPaisa, 0)), { fill: "1.00 0.97 0.43", bold: true, size: 5.4 * slipScale, align: "right" });
    slipTop += totalHeight + slipParts.gap * slipScale;
  }
  return canvas.commands.join("\n");
}

function buildPdf(streams: string[]) {
  const objects: string[] = [];
  const add = (object: string) => { objects.push(object); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const regularFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds = streams.map((stream) => {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) document += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid report date" }, { status: 400 });
  const sheetDate = toSheetDate(date);
  if (Number.isNaN(sheetDate.getTime()) || sheetDate.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: "Invalid report date" }, { status: 400 });

  const sheet = await prisma.stockSheet.findUnique({
    where: { sheetDate },
    include: {
      lines: { include: { product: { select: { sortOrder: true } } } },
      invoices: { orderBy: { createdAt: "asc" } },
      warrantyIns: { orderBy: { createdAt: "asc" } },
      warrantyOuts: { orderBy: { createdAt: "asc" }, include: { pendingWarrantyEntry: { select: { rmaNumber: true, quantity: true } } } },
      purchases: { orderBy: { createdAt: "asc" }, include: { product: { select: { name: true } } } },
      labDeadEntries: { orderBy: { createdAt: "asc" }, include: { product: { select: { name: true } } } },
    },
  });
  if (!sheet) return NextResponse.json({ error: "Stock sheet not found" }, { status: 404 });

  const pendingWarranties = await prisma.pendingWarrantyEntry.findMany({
    where: {
      receivedDate: { lt: sheetDate },
      stockSheet: { sheetDate: { lte: sheetDate } },
      AND: [
        { OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheetDate } }] },
        { OR: [{ billBackDate: null }, { billBackDate: { gte: sheetDate } }] },
      ],
    },
    orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
  });

  const printableSheet = {
    ...sheet,
    pendingWarranties: pendingWarranties.map((entry) => ({ ...entry, billBackChecked: entry.billBackDate?.getTime() === sheetDate.getTime() })),
  };

  const totalSalesPaisa = sheet.invoices.reduce((total, row) => total + row.quantity * row.pricePaisa, 0);
  const streams = [drawStockSheet(sheet), drawDailyEntries(printableSheet, totalSalesPaisa)];
  const billBackEntries = printableSheet.pendingWarranties.filter((entry) => entry.billBackChecked);
  const slips: BillBackSlip[] = [...new Set(billBackEntries.map((entry) => entry.party))]
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }))
    .map((party) => ({ party, entries: billBackEntries.filter((entry) => entry.party === party) }));
  if (sheet.purchases.length || sheet.labDeadEntries.length || slips.length) streams.push(drawPurchaseLabDeadBillBack(sheet, slips));
  const pdf = buildPdf(streams);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BITS-Stock-Report-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
