-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseEntry" ("createdAt", "id", "productId", "quantity", "stockSheetId") SELECT "createdAt", "id", "productId", "quantity", "stockSheetId" FROM "PurchaseEntry";
DROP TABLE "PurchaseEntry";
ALTER TABLE "new_PurchaseEntry" RENAME TO "PurchaseEntry";
CREATE INDEX "PurchaseEntry_stockSheetId_createdAt_idx" ON "PurchaseEntry"("stockSheetId", "createdAt");
CREATE INDEX "PurchaseEntry_productId_idx" ON "PurchaseEntry"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
