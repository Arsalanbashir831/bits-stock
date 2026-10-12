-- CreateTable
CREATE TABLE "PurchaseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabDeadEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabDeadEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabDeadEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "billBackDate" DATETIME,
    "resolvedDate" DATETIME,
    "sourceWarrantyInId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingWarrantyEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingWarrantyEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PendingWarrantyEntry_sourceWarrantyInId_fkey" FOREIGN KEY ("sourceWarrantyInId") REFERENCES "WarrantyInEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PendingWarrantyEntry" ("amountPaisa", "billBackChecked", "createdAt", "id", "invoiceDate", "itemName", "party", "productId", "quantity", "receivedDate", "rmaNumber", "stockSheetId") SELECT "amountPaisa", "billBackChecked", "createdAt", "id", "invoiceDate", "itemName", "party", "productId", "quantity", "receivedDate", "rmaNumber", "stockSheetId" FROM "PendingWarrantyEntry";
DROP TABLE "PendingWarrantyEntry";
ALTER TABLE "new_PendingWarrantyEntry" RENAME TO "PendingWarrantyEntry";
CREATE UNIQUE INDEX "PendingWarrantyEntry_sourceWarrantyInId_key" ON "PendingWarrantyEntry"("sourceWarrantyInId");
CREATE INDEX "PendingWarrantyEntry_stockSheetId_createdAt_idx" ON "PendingWarrantyEntry"("stockSheetId", "createdAt");
CREATE INDEX "PendingWarrantyEntry_rmaNumber_idx" ON "PendingWarrantyEntry"("rmaNumber");
CREATE TABLE "new_StockSheetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sectionName" TEXT,
    "faultyForLab" INTEGER NOT NULL DEFAULT 0,
    "openingFaultyForLab" INTEGER NOT NULL DEFAULT 0,
    "pendingWarranty" INTEGER NOT NULL DEFAULT 0,
    "closingQtyInHand" INTEGER NOT NULL DEFAULT 0,
    "openingQtyInHand" INTEGER NOT NULL DEFAULT 0,
    "openingPw" INTEGER NOT NULL DEFAULT 0,
    "purchase" INTEGER NOT NULL DEFAULT 0,
    "warrantyIn" INTEGER NOT NULL DEFAULT 0,
    "sale" INTEGER NOT NULL DEFAULT 0,
    "warrantyOut" INTEGER NOT NULL DEFAULT 0,
    "labDead" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StockSheetLine_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockSheetLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockSheetLine" ("closingQtyInHand", "faultyForLab", "id", "itemName", "labDead", "openingPw", "openingQtyInHand", "pendingWarranty", "productId", "purchase", "sale", "sectionName", "stockSheetId", "warrantyIn", "warrantyOut") SELECT "closingQtyInHand", "faultyForLab", "id", "itemName", "labDead", "openingPw", "openingQtyInHand", "pendingWarranty", "productId", "purchase", "sale", "sectionName", "stockSheetId", "warrantyIn", "warrantyOut" FROM "StockSheetLine";
DROP TABLE "StockSheetLine";
ALTER TABLE "new_StockSheetLine" RENAME TO "StockSheetLine";
CREATE INDEX "StockSheetLine_productId_idx" ON "StockSheetLine"("productId");
CREATE UNIQUE INDEX "StockSheetLine_stockSheetId_productId_key" ON "StockSheetLine"("stockSheetId", "productId");
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
    "amountPaisa" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarrantyInEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarrantyInEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyInEntry" ("createdAt", "driveStatus", "id", "invoiceDate", "invoiceNumber", "itemName", "party", "productId", "rmaNumber", "stockSheetId") SELECT "createdAt", "driveStatus", "id", "invoiceDate", "invoiceNumber", "itemName", "party", "productId", "rmaNumber", "stockSheetId" FROM "WarrantyInEntry";
DROP TABLE "WarrantyInEntry";
ALTER TABLE "new_WarrantyInEntry" RENAME TO "WarrantyInEntry";
CREATE INDEX "WarrantyInEntry_stockSheetId_createdAt_idx" ON "WarrantyInEntry"("stockSheetId", "createdAt");
CREATE INDEX "WarrantyInEntry_rmaNumber_idx" ON "WarrantyInEntry"("rmaNumber");
CREATE TABLE "new_WarrantyOutEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "rmaSlipNumber" TEXT NOT NULL,
    "pendingWarrantyEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarrantyOutEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarrantyOutEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyOutEntry_pendingWarrantyEntryId_fkey" FOREIGN KEY ("pendingWarrantyEntryId") REFERENCES "PendingWarrantyEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyOutEntry" ("createdAt", "id", "itemName", "party", "productId", "rmaSlipNumber", "stockSheetId") SELECT "createdAt", "id", "itemName", "party", "productId", "rmaSlipNumber", "stockSheetId" FROM "WarrantyOutEntry";
DROP TABLE "WarrantyOutEntry";
ALTER TABLE "new_WarrantyOutEntry" RENAME TO "WarrantyOutEntry";
CREATE INDEX "WarrantyOutEntry_stockSheetId_createdAt_idx" ON "WarrantyOutEntry"("stockSheetId", "createdAt");
CREATE INDEX "WarrantyOutEntry_rmaSlipNumber_idx" ON "WarrantyOutEntry"("rmaSlipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PurchaseEntry_stockSheetId_createdAt_idx" ON "PurchaseEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseEntry_productId_idx" ON "PurchaseEntry"("productId");

-- CreateIndex
CREATE INDEX "LabDeadEntry_stockSheetId_createdAt_idx" ON "LabDeadEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "LabDeadEntry_productId_idx" ON "LabDeadEntry"("productId");
