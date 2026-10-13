import { prisma } from "@/lib/prisma";
import { comparePartyNames } from "@/lib/party-sort";

export function formatPaisa(paisa: number) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(paisa / 100);
}

export function portalNotice(query: { [key: string]: string | string[] | undefined }): { tone: "error" | "success"; text: string } | null {
  if (query.added) return { tone: "success", text: "Changes saved to today’s stock sheet." };
  if (query.error === "closed") return { tone: "error", text: "Today’s stock sheet is closed. Entries are read-only." };
  if (query.error === "date") return { tone: "error", text: "Today’s stock sheet date is invalid. Reload the page and try again." };
  if (query.error === "lab-dead") return { tone: "error", text: "Select at least one faulty item and keep each quantity within its available stock." };
  if (query.error === "warranty-in-linked") return { tone: "error", text: "This Warranty IN is already resolved or billed back. Keep the record and edit it instead." };
  if (query.error) return { tone: "error", text: "Some details are missing or invalid. Check the form and try again." };
  return null;
}

export async function openPendingClaims(today: Date) {
  const claims = await prisma.pendingWarrantyEntry.findMany({
    where: {
      receivedDate: { lt: today },
      stockSheet: { sheetDate: { lte: today } },
      AND: [
        { OR: [{ resolvedDate: null }, { resolvedDate: { gt: today } }] },
        { OR: [{ billBackDate: null }, { billBackDate: { gte: today } }] },
      ],
    },
    orderBy: [{ party: "asc" }, { receivedDate: "asc" }, { itemName: "asc" }],
  });
  return [...claims].sort((left, right) =>
    comparePartyNames(left.party, right.party) ||
    left.receivedDate.getTime() - right.receivedDate.getTime() ||
    left.itemName.localeCompare(right.itemName, "en", { sensitivity: "base" }),
  );
}

export async function activeProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function partyNames() {
  return prisma.party.findMany({ orderBy: { name: "asc" }, select: { name: true } });
}
