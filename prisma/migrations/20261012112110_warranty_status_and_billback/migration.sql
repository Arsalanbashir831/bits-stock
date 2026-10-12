-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingWarrantyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "receivedDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "billBackChecked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingWarrantyEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingWarrantyEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PendingWarrantyEntry" ("amountPaisa", "createdAt", "id", "invoiceDate", "itemName", "party", "productId", "quantity", "receivedDate", "rmaNumber", "stockSheetId") SELECT "amountPaisa", "createdAt", "id", "invoiceDate", "itemName", "party", "productId", "quantity", "receivedDate", "rmaNumber", "stockSheetId" FROM "PendingWarrantyEntry";
DROP TABLE "PendingWarrantyEntry";
ALTER TABLE "new_PendingWarrantyEntry" RENAME TO "PendingWarrantyEntry";
CREATE INDEX "PendingWarrantyEntry_stockSheetId_createdAt_idx" ON "PendingWarrantyEntry"("stockSheetId", "createdAt");
CREATE INDEX "PendingWarrantyEntry_rmaNumber_idx" ON "PendingWarrantyEntry"("rmaNumber");
CREATE TABLE "new_WarrantyInEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "driveStatus" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarrantyInEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarrantyInEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyInEntry" ("createdAt", "id", "invoiceDate", "invoiceNumber", "itemName", "party", "productId", "rmaNumber", "stockSheetId") SELECT "createdAt", "id", "invoiceDate", "invoiceNumber", "itemName", "party", "productId", "rmaNumber", "stockSheetId" FROM "WarrantyInEntry";
DROP TABLE "WarrantyInEntry";
ALTER TABLE "new_WarrantyInEntry" RENAME TO "WarrantyInEntry";
CREATE INDEX "WarrantyInEntry_stockSheetId_createdAt_idx" ON "WarrantyInEntry"("stockSheetId", "createdAt");
CREATE INDEX "WarrantyInEntry_rmaNumber_idx" ON "WarrantyInEntry"("rmaNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
