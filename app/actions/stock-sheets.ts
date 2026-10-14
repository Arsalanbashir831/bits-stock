"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEntryDate } from "@/lib/entry-date";
import { recalculateBillBackTotal, recalculateDeadOutQuantity, recalculateProduct, recalculateSheetClosing } from "@/lib/server/stock-balances";
import { getBusinessDateKey, isTodayOrPreviousStockDay, toSheetDate } from "@/lib/stock-sheet-date";

const PORTAL_PAGES = new Set(["/m", "/m/sale", "/m/warranty", "/m/warranty/out", "/m/pending", "/m/billback", "/m/lab-dead", "/m/purchase"]);

function portalReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  return PORTAL_PAGES.has(returnTo) ? returnTo : null;
}

function parseSheetDate(formData: FormData) {
  const dateKey = String(formData.get("sheetDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const portal = portalReturnPath(formData);
    if (portal) redirect(`${portal}?error=date`);
    redirect(formData.get("returnTo") === "/entries" ? "/entries?error=date" : "/");
  }
  return dateKey;
}

function entryReturnPath(formData: FormData, dateKey: string, anchor: string, error?: string) {
  const portal = portalReturnPath(formData);
  if (portal) return `${portal}?${error ? `error=${error}` : "added=1"}`;
  const basePath = formData.get("returnTo") === "/entries" ? "/entries" : `/sheets/${dateKey}`;
  return `${basePath}${error ? `?error=${error}` : ""}#${anchor}`;
}

function parsePaisa(value: FormDataEntryValue | null) {
  const amount = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  const paisa = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paisa) ? paisa : null;
}

async function getEntryContext(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const sheet = await prisma.stockSheet.findUnique({
    where: { sheetDate: toSheetDate(dateKey) },
    select: { id: true, sheetDate: true, status: true },
  });
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, category: true, isActive: true },
  });

  if (!sheet || sheet.status !== "OPEN") redirect(entryReturnPath(formData, dateKey, "entry", "closed"));
  if (!product?.isActive) redirect(entryReturnPath(formData, dateKey, "entry", "entry"));
  return { dateKey, sheet, product };
}

async function requireOpenSheet(tx: Prisma.TransactionClient, stockSheetId: string, formData: FormData, dateKey: string, anchor: string) {
  const sheet = await tx.stockSheet.findFirst({ where: { id: stockSheetId, status: "OPEN" }, select: { id: true } });
  if (!sheet) redirect(entryReturnPath(formData, dateKey, anchor, "closed"));
}

async function ensureParty(tx: Prisma.TransactionClient, partyName: string) {
  const normalizedName = partyName.trim().toLocaleLowerCase("en");
  if (!normalizedName) return;
  await tx.party.upsert({
    where: { normalizedName },
    update: {},
    create: { name: partyName.trim(), normalizedName },
  });
}

async function getEditableSheet(formData: FormData, dateKey: string, anchor: string) {
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(dateKey) }, select: { id: true, sheetDate: true, status: true } });
  if (!sheet) redirect(entryReturnPath(formData, dateKey, anchor, anchor));
  if (sheet.status !== "OPEN" && !isTodayOrPreviousStockDay(dateKey)) redirect(entryReturnPath(formData, dateKey, anchor, "closed"));
  return sheet;
}

async function requireEditableSheet(tx: Prisma.TransactionClient, stockSheetId: string, formData: FormData, dateKey: string, anchor: string) {
  const sheet = await tx.stockSheet.findUnique({ where: { id: stockSheetId }, select: { id: true, sheetDate: true, status: true } });
  if (!sheet || (sheet.status !== "OPEN" && !isTodayOrPreviousStockDay(sheet.sheetDate.toISOString().slice(0, 10)))) redirect(entryReturnPath(formData, dateKey, anchor, "closed"));
}

function refreshSheet(dateKey: string) {
  revalidatePath(`/sheets/${dateKey}`);
  revalidatePath("/entries");
  revalidatePath("/m");
  revalidatePath("/m/sale");
  revalidatePath("/m/warranty");
  revalidatePath("/m/warranty/out");
  revalidatePath("/m/pending");
  revalidatePath("/m/billback");
  revalidatePath("/m/lab-dead");
  revalidatePath("/");
}

function closingReturnPath(formData: FormData, dateKey: string, state: "prepared" | "closed") {
  if (formData.get("returnTo") === "/entries") return `/entries?${state}=1`;
  return `/sheets/${dateKey}?${state}=1#stock-report`;
}

export async function prepareStockSheetClosing(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const sheetDate = toSheetDate(dateKey);
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate }, select: { id: true, sheetDate: true, status: true } });
  if (!sheet) redirect(`/sheets/${dateKey}?error=close`);
  if (sheet.status === "CLOSED") redirect(closingReturnPath(formData, dateKey, "closed"));

  await prisma.$transaction(async (tx) => {
    const current = await tx.stockSheet.findFirst({ where: { id: sheet.id, status: "OPEN" }, select: { id: true, sheetDate: true } });
    if (!current) return;
    await recalculateSheetClosing(current.id, current.sheetDate, tx);
    await tx.stockSheet.update({ where: { id: current.id }, data: { closingPreparedAt: new Date() } });
  });

  refreshSheet(dateKey);
  redirect(`/sheets/${dateKey}?prepared=1#stock-report`);
}

export async function closeStockSheet(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const sheetDate = toSheetDate(dateKey);
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate }, select: { id: true, sheetDate: true, status: true, closingPreparedAt: true } });
  if (!sheet) redirect(`/sheets/${dateKey}?error=close`);
  if (sheet.status === "CLOSED") redirect(closingReturnPath(formData, dateKey, "closed"));
  if (!sheet.closingPreparedAt) redirect(`${formData.get("returnTo") === "/entries" ? "/entries" : `/sheets/${dateKey}`}?error=prepare-close`);

  await prisma.$transaction(async (tx) => {
    const current = await tx.stockSheet.findFirst({ where: { id: sheet.id, status: "OPEN" }, select: { id: true, sheetDate: true, closingPreparedAt: true } });
    if (!current) return;
    if (!current.closingPreparedAt) redirect(`${formData.get("returnTo") === "/entries" ? "/entries" : `/sheets/${dateKey}`}?error=prepare-close`);
    await recalculateSheetClosing(current.id, current.sheetDate, tx);
    await tx.stockSheet.update({ where: { id: current.id }, data: { status: "CLOSED", closedAt: new Date() } });
  });

  refreshSheet(dateKey);
  revalidatePath("/");
  redirect(closingReturnPath(formData, dateKey, "closed"));
}

export async function createTodayStockSheet() {
  const dateKey = getBusinessDateKey();
  const sheetDate = toSheetDate(dateKey);
  const existing = await prisma.stockSheet.findUnique({
    where: { sheetDate },
    select: { id: true },
  });

  if (existing) redirect(`/sheets/${dateKey}`);

  const [products, previousSheet] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    }),
    prisma.stockSheet.findFirst({
      where: { sheetDate: { lt: sheetDate } },
      orderBy: { sheetDate: "desc" },
      include: {
        lines: { select: { productId: true, closingQtyInHand: true, pendingWarranty: true, faultyForLab: true } },
      },
    }),
  ]);

  const previousClosing = new Map(
    previousSheet?.lines.map((line) => [line.productId, line.closingQtyInHand]) ??
      [],
  );
  const previousPendingWarranty = new Map(
    previousSheet?.lines.map((line) => [line.productId, line.pendingWarranty]) ?? [],
  );
  const previousFaultyForLab = new Map(
    previousSheet?.lines.map((line) => [line.productId, line.faultyForLab]) ?? [],
  );

  let stockSheetId: string;
  try {
    const sheet = await prisma.stockSheet.create({
      data: {
        sheetDate,
        lines: {
          create: products.map(({ id: productId, name, category }) => {
            const openingQtyInHand = previousClosing.get(productId) ?? 0;
            return {
              productId,
              itemName: name,
              sectionName: category,
              openingQtyInHand,
              openingPw: previousPendingWarranty.get(productId) ?? 0,
              openingFaultyForLab: previousFaultyForLab.get(productId) ?? 0,
              pendingWarranty: previousPendingWarranty.get(productId) ?? 0,
              faultyForLab: previousFaultyForLab.get(productId) ?? 0,
              closingQtyInHand: openingQtyInHand,
            };
          }),
        },
      },
      select: { id: true },
    });
    stockSheetId = sheet.id;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect(`/sheets/${dateKey}`);
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/sheets/${dateKey}`);
  redirect(`/sheets/${dateKey}?created=${stockSheetId}`);
}

export async function addProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "Other").trim();
  const requestedSku = String(formData.get("sku") ?? "").trim();

  if (!name) redirect("/?error=product-name");

  const product = await prisma.product.create({
    data: {
      name,
      category,
      sku: requestedSku || `NEW-${randomUUID().slice(0, 8).toUpperCase()}`,
      sortOrder: 1000,
    },
    select: { id: true },
  });

  const dateKey = getBusinessDateKey();
  const todaySheet = await prisma.stockSheet.findUnique({
    where: { sheetDate: toSheetDate(dateKey) },
    select: { id: true, status: true },
  });

  if (todaySheet?.status === "OPEN") {
    await prisma.stockSheetLine.create({
      data: {
        stockSheetId: todaySheet.id,
        productId: product.id,
        itemName: name,
        sectionName: category,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(`/sheets/${dateKey}`);
  redirect("/?product-added=1");
}

export async function addInvoiceEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const pricePaisa = parsePaisa(formData.get("price"));
  const { sheet, product } = await getEntryContext(formData);

  if (!invoiceNumber || !Number.isSafeInteger(quantity) || quantity < 1 || pricePaisa === null) {
    redirect(entryReturnPath(formData, dateKey, "invoices", "invoice"));
  }

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "invoices");
    await tx.invoiceEntry.create({
      data: {
        stockSheetId: sheet.id,
        productId: product.id,
        invoiceNumber,
        itemName: product.name,
        quantity,
        pricePaisa,
      },
    });
    await recalculateProduct(product.id, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "invoices"));
}

export async function addWarrantyInEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const party = String(formData.get("party") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const invoiceDate = parseEntryDate(String(formData.get("invoiceDate") ?? ""));
  const rmaNumber = String(formData.get("rmaNumber") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const amountPaisa = parsePaisa(formData.get("amount"));
  const driveStatus = String(formData.get("driveStatus") ?? "");
  const { sheet, product } = await getEntryContext(formData);
  if (!invoiceDate) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "entry-date"));
  if (!party || !invoiceNumber || !rmaNumber || !Number.isSafeInteger(quantity) || quantity < 1 || amountPaisa === null || !["OK", "FAULTY_FOR_LAB"].includes(driveStatus)) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "warranty-in"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "today-warranty-in");
    await ensureParty(tx, party);
    const warrantyIn = await tx.warrantyInEntry.create({
      data: {
        stockSheetId: sheet.id,
        productId: product.id,
        party,
        itemName: product.name,
        invoiceNumber,
        invoiceDate,
        rmaNumber,
        driveStatus,
        quantity,
        amountPaisa,
      },
      select: { id: true },
    });
    await tx.pendingWarrantyEntry.create({
      data: {
        stockSheetId: sheet.id,
        productId: product.id,
        itemName: product.name,
        party,
        receivedDate: sheet.sheetDate,
        quantity,
        invoiceDate,
        rmaNumber,
        amountPaisa,
        sourceWarrantyInId: warrantyIn.id,
      },
    });
    await recalculateProduct(product.id, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-in"));
}

export async function addWarrantyOutEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const pendingWarrantyId = String(formData.get("pendingWarrantyId") ?? "");
  const rmaSlipNumber = String(formData.get("rmaSlipNumber") ?? "").trim();
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(dateKey) }, select: { id: true, sheetDate: true, status: true } });
  if (!sheet) redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "warranty-out"));
  if (sheet.status !== "OPEN") redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "closed"));
  const pending = pendingWarrantyId ? await prisma.pendingWarrantyEntry.findFirst({
    where: {
      id: pendingWarrantyId,
      stockSheet: { sheetDate: { lte: sheet.sheetDate } },
      receivedDate: { lte: sheet.sheetDate },
      AND: [
        { OR: [{ billBackDate: null }, { billBackDate: { gt: sheet.sheetDate } }] },
        { OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheet.sheetDate } }] },
      ],
    },
    include: { product: { select: { id: true, name: true, category: true } } },
  }) : null;
  if (!pending || !rmaSlipNumber) redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "warranty-out"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "today-warranty-out");
    await tx.warrantyOutEntry.create({
      data: {
        stockSheetId: sheet.id,
        productId: pending.productId,
        party: pending.party,
        itemName: pending.itemName,
        rmaSlipNumber,
        pendingWarrantyEntryId: pending.id,
      },
    });
    await tx.pendingWarrantyEntry.update({ where: { id: pending.id }, data: { resolvedDate: sheet.sheetDate } });
    await recalculateProduct(pending.productId, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-out"));
}

export async function addPendingWarrantyEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const party = String(formData.get("party") ?? "").trim();
  const receivedDateKey = String(formData.get("receivedDate") ?? "");
  const invoiceDateKey = String(formData.get("invoiceDate") ?? "");
  const receivedDate = parseEntryDate(receivedDateKey);
  const invoiceDate = parseEntryDate(invoiceDateKey);
  const quantity = Number(formData.get("quantity"));
  const rmaNumber = String(formData.get("rmaNumber") ?? "").trim();
  const amountPaisa = parsePaisa(formData.get("amount"));
  const { sheet, product } = await getEntryContext(formData);

  if (!receivedDate || !invoiceDate) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "entry-date"));
  if (!party || receivedDate > sheet.sheetDate || !rmaNumber || !Number.isSafeInteger(quantity) || quantity < 1 || amountPaisa === null) {
    redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));
  }

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "pending-warranty");
    await ensureParty(tx, party);
    await tx.pendingWarrantyEntry.create({
      data: {
        stockSheetId: sheet.id,
        productId: product.id,
        itemName: product.name,
        party,
        receivedDate,
        quantity,
        invoiceDate,
        rmaNumber,
        amountPaisa,
      },
    });
    await recalculateProduct(product.id, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "pending-warranty"));
}

export async function editPendingWarrantyEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("pendingWarrantyId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const party = String(formData.get("party") ?? "").trim();
  const receivedDateKey = String(formData.get("receivedDate") ?? "");
  const invoiceDateKey = String(formData.get("invoiceDate") ?? "");
  const quantity = Number(formData.get("quantity"));
  const rmaNumber = String(formData.get("rmaNumber") ?? "").trim();
  const amountPaisa = parsePaisa(formData.get("amount"));
  const receivedDate = parseEntryDate(receivedDateKey);
  const invoiceDate = parseEntryDate(invoiceDateKey);
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(dateKey) }, select: { id: true, sheetDate: true, status: true } });
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true, name: true } });
  if (!receivedDate || !invoiceDate) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "entry-date"));
  if (!id || !sheet || !product || !party || receivedDate > sheet.sheetDate || !Number.isSafeInteger(quantity) || quantity < 1 || !rmaNumber || amountPaisa === null) {
    redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));
  }
  if (sheet.status !== "OPEN" && !isTodayOrPreviousStockDay(dateKey)) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "closed"));
  const validReceivedDate = receivedDate;
  const validInvoiceDate = invoiceDate;
  const existing = await prisma.pendingWarrantyEntry.findFirst({
    where: {
      id,
      stockSheet: { sheetDate: { lte: sheet.sheetDate } },
      receivedDate: { lte: sheet.sheetDate },
      AND: [{ OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheet.sheetDate } }] }],
    },
    select: { id: true, productId: true, sourceWarrantyInId: true },
  });
  if (!existing) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "pending-warranty");
    await ensureParty(tx, party);
    await tx.pendingWarrantyEntry.update({
      where: { id },
      data: { productId: product.id, itemName: product.name, party, receivedDate: validReceivedDate, quantity, invoiceDate: validInvoiceDate, rmaNumber, amountPaisa },
    });
    if (existing.sourceWarrantyInId) {
      await tx.warrantyInEntry.update({
        where: { id: existing.sourceWarrantyInId },
        data: { productId: product.id, itemName: product.name, party, invoiceDate: validInvoiceDate, rmaNumber, quantity, amountPaisa },
      });
    }
    await recalculateProduct(existing.productId, tx);
    if (existing.productId !== product.id) await recalculateProduct(product.id, tx);
    await recalculateBillBackTotal(sheet.sheetDate, tx);
  }, { timeout: 30_000 });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "pending-warranty"));
}

export async function deletePendingWarrantyEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("pendingWarrantyId") ?? "");
  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(dateKey) }, select: { id: true, sheetDate: true, status: true } });
  if (!id || !sheet) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));
  if (sheet.status !== "OPEN") redirect(entryReturnPath(formData, dateKey, "pending-warranty", "closed"));
  const entry = await prisma.pendingWarrantyEntry.findFirst({
    where: {
      id,
      stockSheet: { sheetDate: { lte: sheet.sheetDate } },
      receivedDate: { lte: sheet.sheetDate },
      AND: [{ OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheet.sheetDate } }] }],
    },
    select: { id: true, productId: true, billBackDate: true },
  });
  if (!entry) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "pending-warranty");
    await tx.pendingWarrantyEntry.delete({ where: { id: entry.id } });
    await recalculateProduct(entry.productId, tx);
    if (entry.billBackDate) await recalculateBillBackTotal(entry.billBackDate, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "pending-warranty"));
}

export async function setPendingWarrantyBillBackCheck(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("pendingWarrantyId") ?? "");
  const billBackChecked = formData.get("billBackChecked") === "true";
  if (!id) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));

  const sheet = await prisma.stockSheet.findUnique({ where: { sheetDate: toSheetDate(dateKey) }, select: { id: true, sheetDate: true, status: true } });
  if (!sheet) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));
  if (sheet.status !== "OPEN") redirect(entryReturnPath(formData, dateKey, "pending-warranty", "closed"));
  const entry = await prisma.pendingWarrantyEntry.findFirst({
    where: {
      id,
      stockSheet: { sheetDate: { lte: sheet.sheetDate } },
      receivedDate: { lte: sheet.sheetDate },
      resolvedDate: null,
    },
    select: { id: true, billBackDate: true },
  });
  if (!entry) redirect(entryReturnPath(formData, dateKey, "pending-warranty", "pending-warranty"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "pending-warranty");
    const updated = await tx.pendingWarrantyEntry.update({
      where: { id },
      data: { billBackChecked, billBackDate: billBackChecked ? sheet.sheetDate : null },
      select: { productId: true },
    });
    await recalculateProduct(updated.productId, tx);
    if (entry.billBackDate && entry.billBackDate.getTime() !== sheet.sheetDate.getTime()) {
      await recalculateBillBackTotal(entry.billBackDate, tx);
    }
    await recalculateBillBackTotal(sheet.sheetDate, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "pending-warranty"));
}

export async function addPurchaseEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const quantity = Number(formData.get("quantity"));
  const party = String(formData.get("party") ?? "").trim();
  const { sheet, product } = await getEntryContext(formData);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !party) redirect(entryReturnPath(formData, dateKey, "purchases", "purchase"));
  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "purchases");
    await ensureParty(tx, party);
    await tx.purchaseEntry.create({ data: { stockSheetId: sheet.id, productId: product.id, party, quantity } });
    await recalculateProduct(product.id, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "purchases"));
}

export async function addLabDeadEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const quantity = Number(formData.get("quantity"));
  const { sheet, product } = await getEntryContext(formData);
  if (!Number.isSafeInteger(quantity) || quantity < 1) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  const line = await prisma.stockSheetLine.findUnique({ where: { stockSheetId_productId: { stockSheetId: sheet.id, productId: product.id } }, select: { faultyForLab: true } });
  if (!line || quantity > line.faultyForLab) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "lab-dead");
    await tx.labDeadEntry.create({ data: { stockSheetId: sheet.id, productId: product.id, quantity } });
    await recalculateProduct(product.id, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "lab-dead"));
}

export async function addLabDeadEntries(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const productIds = [...new Set(formData.getAll("productIds").map(String).filter(Boolean))];
  if (!productIds.length) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));

  const sheet = await prisma.stockSheet.findUnique({
    where: { sheetDate: toSheetDate(dateKey) },
    select: { id: true, status: true },
  });
  if (!sheet || sheet.status !== "OPEN") redirect(entryReturnPath(formData, dateKey, "lab-dead", "closed"));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true },
  });
  if (products.length !== productIds.length) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));

  const entries = productIds.map((productId) => ({
    productId,
    quantity: Number(formData.get(`quantity_${productId}`)),
  }));
  if (entries.some((entry) => !Number.isSafeInteger(entry.quantity) || entry.quantity < 1)) {
    redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  }

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "lab-dead");
    const lines = await tx.stockSheetLine.findMany({
      where: { stockSheetId: sheet.id, productId: { in: productIds } },
      select: { productId: true, faultyForLab: true },
    });
    const availableByProduct = new Map(lines.map((line) => [line.productId, line.faultyForLab]));
    if (entries.some((entry) => (availableByProduct.get(entry.productId) ?? 0) < entry.quantity)) {
      redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
    }

    for (const entry of entries) {
      await tx.labDeadEntry.create({ data: { stockSheetId: sheet.id, ...entry } });
    }
    for (const entry of entries) await recalculateProduct(entry.productId, tx);
    await recalculateDeadOutQuantity(sheet.id, tx);
  });

  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "lab-dead"));
}

export async function editInvoiceEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("invoiceId") ?? "");
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const pricePaisa = parsePaisa(formData.get("price"));
  const sheet = await getEditableSheet(formData, dateKey, "invoices");
  const product = await prisma.product.findFirst({ where: { id: String(formData.get("productId") ?? ""), isActive: true }, select: { id: true, name: true } });
  if (!id || !invoiceNumber || !product || !Number.isSafeInteger(quantity) || quantity < 1 || pricePaisa === null) redirect(entryReturnPath(formData, dateKey, "invoices", "invoice"));
  const existing = await prisma.invoiceEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true, quantity: true } });
  if (!existing) redirect(entryReturnPath(formData, dateKey, "invoices", "invoice"));

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "invoices");
    await tx.invoiceEntry.update({ where: { id }, data: { productId: product.id, itemName: product.name, invoiceNumber, quantity, pricePaisa } });
    if (existing.productId !== product.id || existing.quantity !== quantity) {
      await recalculateProduct(existing.productId, tx);
      if (existing.productId !== product.id) await recalculateProduct(product.id, tx);
    }
  }, { timeout: 30_000 });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "invoices"));
}

export async function deleteInvoiceEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("invoiceId") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "invoices");
  const existing = id ? await prisma.invoiceEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } }) : null;
  if (!existing) redirect(entryReturnPath(formData, dateKey, "invoices", "invoice"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "invoices");
    await tx.invoiceEntry.delete({ where: { id } });
    await recalculateProduct(existing.productId, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "invoices"));
}

export async function editPurchaseEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("purchaseId") ?? "");
  const party = String(formData.get("party") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const sheet = await getEditableSheet(formData, dateKey, "purchases");
  const product = await prisma.product.findFirst({ where: { id: String(formData.get("productId") ?? ""), isActive: true }, select: { id: true, name: true } });
  if (!id || !party || !product || !Number.isSafeInteger(quantity) || quantity < 1) redirect(entryReturnPath(formData, dateKey, "purchases", "purchase"));
  const existing = await prisma.purchaseEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } });
  if (!existing) redirect(entryReturnPath(formData, dateKey, "purchases", "purchase"));

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "purchases");
    await ensureParty(tx, party);
    await tx.purchaseEntry.update({ where: { id }, data: { productId: product.id, party, quantity } });
    await recalculateProduct(existing.productId, tx);
    if (existing.productId !== product.id) await recalculateProduct(product.id, tx);
  }, { timeout: 30_000 });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "purchases"));
}

export async function deletePurchaseEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("purchaseId") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "purchases");
  const existing = id ? await prisma.purchaseEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } }) : null;
  if (!existing) redirect(entryReturnPath(formData, dateKey, "purchases", "purchase"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "purchases");
    await tx.purchaseEntry.delete({ where: { id } });
    await recalculateProduct(existing.productId, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "purchases"));
}

export async function editWarrantyInEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("warrantyInId") ?? "");
  const party = String(formData.get("party") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const invoiceDate = parseEntryDate(String(formData.get("invoiceDate") ?? ""));
  const rmaNumber = String(formData.get("rmaNumber") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const amountPaisa = parsePaisa(formData.get("amount"));
  const driveStatus = String(formData.get("driveStatus") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "today-warranty-in");
  const product = await prisma.product.findFirst({ where: { id: String(formData.get("productId") ?? ""), isActive: true }, select: { id: true, name: true } });
  if (!invoiceDate) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "entry-date"));
  if (!id || !party || !invoiceNumber || !rmaNumber || !Number.isSafeInteger(quantity) || quantity < 1 || amountPaisa === null || !["OK", "FAULTY_FOR_LAB"].includes(driveStatus) || !product) {
    redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "warranty-in"));
  }
  const existing = await prisma.warrantyInEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } });
  if (!existing) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "warranty-in"));

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "today-warranty-in");
    await ensureParty(tx, party);
    await tx.warrantyInEntry.update({
      where: { id },
      data: { productId: product.id, itemName: product.name, party, invoiceNumber, invoiceDate, rmaNumber, driveStatus, quantity, amountPaisa },
    });
    const linked = await tx.pendingWarrantyEntry.findUnique({ where: { sourceWarrantyInId: id }, select: { id: true, billBackDate: true } });
    if (linked) {
      await tx.pendingWarrantyEntry.update({ where: { id: linked.id }, data: { productId: product.id, itemName: product.name, party, invoiceDate, rmaNumber, quantity, amountPaisa } });
      if (linked.billBackDate) await recalculateBillBackTotal(linked.billBackDate, tx);
    }
    await recalculateProduct(existing.productId, tx);
    if (existing.productId !== product.id) await recalculateProduct(product.id, tx);
  }, { timeout: 30_000 });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-in"));
}

export async function deleteWarrantyInEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("warrantyInId") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "today-warranty-in");
  const existing = id ? await prisma.warrantyInEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } }) : null;
  if (!existing) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "warranty-in"));
  const linked = await prisma.pendingWarrantyEntry.findUnique({ where: { sourceWarrantyInId: id }, select: { id: true, billBackDate: true, resolvedDate: true } });
  if (linked && (linked.billBackDate || linked.resolvedDate)) redirect(entryReturnPath(formData, dateKey, "today-warranty-in", "warranty-in-linked"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "today-warranty-in");
    if (linked) await tx.pendingWarrantyEntry.delete({ where: { id: linked.id } });
    await tx.warrantyInEntry.delete({ where: { id } });
    await recalculateProduct(existing.productId, tx);
    if (linked?.billBackDate) await recalculateBillBackTotal(linked.billBackDate, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-in"));
}

const openClaimWhere = (sheetId: Date) => ({
  stockSheet: { sheetDate: { lte: sheetId } },
  receivedDate: { lte: sheetId },
  AND: [
    { OR: [{ billBackDate: null }, { billBackDate: { gt: sheetId } }] },
    { OR: [{ resolvedDate: null }, { resolvedDate: { gt: sheetId } }] },
  ],
});

export async function editWarrantyOutEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("warrantyOutId") ?? "");
  const pendingWarrantyId = String(formData.get("pendingWarrantyId") ?? "");
  const rmaSlipNumber = String(formData.get("rmaSlipNumber") ?? "").trim();
  const sheet = await getEditableSheet(formData, dateKey, "today-warranty-out");
  if (!id || !rmaSlipNumber) redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "warranty-out"));
  const existing = await prisma.warrantyOutEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true, pendingWarrantyEntryId: true } });
  const pending = pendingWarrantyId && existing?.pendingWarrantyEntryId === pendingWarrantyId
    ? await prisma.pendingWarrantyEntry.findUnique({ where: { id: pendingWarrantyId }, select: { id: true, productId: true, itemName: true, party: true } })
    : pendingWarrantyId
      ? await prisma.pendingWarrantyEntry.findFirst({ where: { id: pendingWarrantyId, ...openClaimWhere(sheet.sheetDate) }, select: { id: true, productId: true, itemName: true, party: true } })
      : null;
  if (!existing || !pending) redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "warranty-out"));

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "today-warranty-out");
    await tx.warrantyOutEntry.update({ where: { id }, data: { pendingWarrantyEntryId: pending.id, rmaSlipNumber, productId: pending.productId, itemName: pending.itemName, party: pending.party } });
    if (existing.pendingWarrantyEntryId && existing.pendingWarrantyEntryId !== pending.id) {
      await tx.pendingWarrantyEntry.update({ where: { id: existing.pendingWarrantyEntryId }, data: { resolvedDate: null } });
    }
    await tx.pendingWarrantyEntry.update({ where: { id: pending.id }, data: { resolvedDate: sheet.sheetDate } });
    await recalculateProduct(existing.productId, tx);
    if (existing.productId !== pending.productId) await recalculateProduct(pending.productId, tx);
  }, { timeout: 30_000 });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-out"));
}

export async function deleteWarrantyOutEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("warrantyOutId") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "today-warranty-out");
  const existing = id ? await prisma.warrantyOutEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true, pendingWarrantyEntryId: true } }) : null;
  if (!existing) redirect(entryReturnPath(formData, dateKey, "today-warranty-out", "warranty-out"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "today-warranty-out");
    await tx.warrantyOutEntry.delete({ where: { id } });
    if (existing.pendingWarrantyEntryId) await tx.pendingWarrantyEntry.update({ where: { id: existing.pendingWarrantyEntryId }, data: { resolvedDate: null } });
    await recalculateProduct(existing.productId, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "today-warranty-out"));
}

export async function editLabDeadEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("labDeadId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const sheet = await getEditableSheet(formData, dateKey, "lab-dead");
  const product = await prisma.product.findFirst({ where: { id: String(formData.get("productId") ?? ""), isActive: true }, select: { id: true, name: true } });
  if (!id || !product || !Number.isSafeInteger(quantity) || quantity < 1) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  const existing = await prisma.labDeadEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true, quantity: true } });
  if (!existing) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  const line = await prisma.stockSheetLine.findUnique({ where: { stockSheetId_productId: { stockSheetId: sheet.id, productId: existing.productId } }, select: { faultyForLab: true } });
  if (!line || quantity > line.faultyForLab + existing.quantity) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  if (existing.productId !== product.id) {
    const targetLine = await prisma.stockSheetLine.findUnique({ where: { stockSheetId_productId: { stockSheetId: sheet.id, productId: product.id } }, select: { faultyForLab: true } });
    if (!targetLine || quantity > targetLine.faultyForLab) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));
  }

  await prisma.$transaction(async (tx) => {
    await requireEditableSheet(tx, sheet.id, formData, dateKey, "lab-dead");
    await tx.labDeadEntry.update({ where: { id }, data: { productId: product.id, quantity } });
    await recalculateProduct(existing.productId, tx);
    if (existing.productId !== product.id) await recalculateProduct(product.id, tx);
    await recalculateDeadOutQuantity(sheet.id, tx);
  }, { timeout: 30_000 });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "lab-dead"));
}

export async function deleteLabDeadEntry(formData: FormData) {
  const dateKey = parseSheetDate(formData);
  const id = String(formData.get("labDeadId") ?? "");
  const sheet = await getEditableSheet(formData, dateKey, "lab-dead");
  const existing = id ? await prisma.labDeadEntry.findFirst({ where: { id, stockSheetId: sheet.id }, select: { productId: true } }) : null;
  if (!existing) redirect(entryReturnPath(formData, dateKey, "lab-dead", "lab-dead"));

  await prisma.$transaction(async (tx) => {
    await requireOpenSheet(tx, sheet.id, formData, dateKey, "lab-dead");
    await tx.labDeadEntry.delete({ where: { id } });
    await recalculateProduct(existing.productId, tx);
    await recalculateDeadOutQuantity(sheet.id, tx);
  });
  refreshSheet(dateKey);
  redirect(entryReturnPath(formData, dateKey, "lab-dead"));
}

