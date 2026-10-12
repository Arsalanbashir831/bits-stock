-- CreateTable
CREATE TABLE "InvoiceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePaisa" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarrantyInEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarrantyInEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarrantyInEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarrantyOutEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "rmaSlipNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarrantyOutEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarrantyOutEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingWarrantyEntry" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingWarrantyEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingWarrantyEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetDate" DATETIME NOT NULL,
    "billBackPaisa" INTEGER NOT NULL DEFAULT 0,
    "deadOutQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockSheet" ("createdAt", "id", "sheetDate", "updatedAt") SELECT "createdAt", "id", "sheetDate", "updatedAt" FROM "StockSheet";
DROP TABLE "StockSheet";
ALTER TABLE "new_StockSheet" RENAME TO "StockSheet";
CREATE UNIQUE INDEX "StockSheet_sheetDate_key" ON "StockSheet"("sheetDate");
CREATE INDEX "StockSheet_sheetDate_idx" ON "StockSheet"("sheetDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InvoiceEntry_stockSheetId_createdAt_idx" ON "InvoiceEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceEntry_invoiceNumber_idx" ON "InvoiceEntry"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceEntry_productId_idx" ON "InvoiceEntry"("productId");

-- CreateIndex
CREATE INDEX "WarrantyInEntry_stockSheetId_createdAt_idx" ON "WarrantyInEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "WarrantyInEntry_rmaNumber_idx" ON "WarrantyInEntry"("rmaNumber");

-- CreateIndex
CREATE INDEX "WarrantyOutEntry_stockSheetId_createdAt_idx" ON "WarrantyOutEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "WarrantyOutEntry_rmaSlipNumber_idx" ON "WarrantyOutEntry"("rmaSlipNumber");

-- CreateIndex
CREATE INDEX "PendingWarrantyEntry_stockSheetId_createdAt_idx" ON "PendingWarrantyEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingWarrantyEntry_rmaNumber_idx" ON "PendingWarrantyEntry"("rmaNumber");
