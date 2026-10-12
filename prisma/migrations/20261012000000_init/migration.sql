-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "costPaisa" INTEGER NOT NULL DEFAULT 0,
    "pricePaisa" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "reference" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockReceiptItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostPaisa" INTEGER NOT NULL,
    CONSTRAINT "StockReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "subtotalPaisa" INTEGER NOT NULL DEFAULT 0,
    "discountPaisa" INTEGER NOT NULL DEFAULT 0,
    "totalPaisa" INTEGER NOT NULL DEFAULT 0,
    "paidPaisa" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaisa" INTEGER NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleItemId" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "issue" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyClaim_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockSheetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sectionName" TEXT,
    "faultyForLab" INTEGER NOT NULL DEFAULT 0,
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

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "StockReceipt_supplierId_idx" ON "StockReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "StockReceipt_receivedAt_idx" ON "StockReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "StockReceiptItem_receiptId_idx" ON "StockReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_productId_idx" ON "StockReceiptItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNumber_key" ON "Sale"("receiptNumber");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimNumber_key" ON "WarrantyClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "WarrantyClaim_saleItemId_idx" ON "WarrantyClaim"("saleItemId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_receivedAt_idx" ON "WarrantyClaim"("receivedAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "StockSheet_sheetDate_key" ON "StockSheet"("sheetDate");

-- CreateIndex
CREATE INDEX "StockSheet_sheetDate_idx" ON "StockSheet"("sheetDate");

-- CreateIndex
CREATE INDEX "StockSheetLine_productId_idx" ON "StockSheetLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockSheetLine_stockSheetId_productId_key" ON "StockSheetLine"("stockSheetId", "productId");
