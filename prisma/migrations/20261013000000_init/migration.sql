-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostPaisa" INTEGER NOT NULL,

    CONSTRAINT "StockReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "subtotalPaisa" INTEGER NOT NULL DEFAULT 0,
    "discountPaisa" INTEGER NOT NULL DEFAULT 0,
    "totalPaisa" INTEGER NOT NULL DEFAULT 0,
    "paidPaisa" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaisa" INTEGER NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "issue" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSheet" (
    "id" TEXT NOT NULL,
    "sheetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closingPreparedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "billBackPaisa" INTEGER NOT NULL DEFAULT 0,
    "deadOutQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSheetLine" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "StockSheetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePaisa" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyInEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "driveStatus" TEXT NOT NULL DEFAULT 'OK',
    "amountPaisa" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyInEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyOutEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "rmaSlipNumber" TEXT NOT NULL,
    "pendingWarrantyEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyOutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingWarrantyEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "billBackChecked" BOOLEAN NOT NULL DEFAULT false,
    "billBackDate" TIMESTAMP(3),
    "resolvedDate" TIMESTAMP(3),
    "sourceWarrantyInId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingWarrantyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "party" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabDeadEntry" (
    "id" TEXT NOT NULL,
    "stockSheetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabDeadEntry_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "Party_normalizedName_key" ON "Party"("normalizedName");

-- CreateIndex
CREATE INDEX "Party_name_idx" ON "Party"("name");

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
CREATE UNIQUE INDEX "PendingWarrantyEntry_sourceWarrantyInId_key" ON "PendingWarrantyEntry"("sourceWarrantyInId");

-- CreateIndex
CREATE INDEX "PendingWarrantyEntry_stockSheetId_createdAt_idx" ON "PendingWarrantyEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingWarrantyEntry_rmaNumber_idx" ON "PendingWarrantyEntry"("rmaNumber");

-- CreateIndex
CREATE INDEX "PurchaseEntry_stockSheetId_createdAt_idx" ON "PurchaseEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseEntry_productId_idx" ON "PurchaseEntry"("productId");

-- CreateIndex
CREATE INDEX "LabDeadEntry_stockSheetId_createdAt_idx" ON "LabDeadEntry"("stockSheetId", "createdAt");

-- CreateIndex
CREATE INDEX "LabDeadEntry_productId_idx" ON "LabDeadEntry"("productId");

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSheetLine" ADD CONSTRAINT "StockSheetLine_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSheetLine" ADD CONSTRAINT "StockSheetLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceEntry" ADD CONSTRAINT "InvoiceEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceEntry" ADD CONSTRAINT "InvoiceEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyInEntry" ADD CONSTRAINT "WarrantyInEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyInEntry" ADD CONSTRAINT "WarrantyInEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyOutEntry" ADD CONSTRAINT "WarrantyOutEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyOutEntry" ADD CONSTRAINT "WarrantyOutEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyOutEntry" ADD CONSTRAINT "WarrantyOutEntry_pendingWarrantyEntryId_fkey" FOREIGN KEY ("pendingWarrantyEntryId") REFERENCES "PendingWarrantyEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingWarrantyEntry" ADD CONSTRAINT "PendingWarrantyEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingWarrantyEntry" ADD CONSTRAINT "PendingWarrantyEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingWarrantyEntry" ADD CONSTRAINT "PendingWarrantyEntry_sourceWarrantyInId_fkey" FOREIGN KEY ("sourceWarrantyInId") REFERENCES "WarrantyInEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseEntry" ADD CONSTRAINT "PurchaseEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseEntry" ADD CONSTRAINT "PurchaseEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabDeadEntry" ADD CONSTRAINT "LabDeadEntry_stockSheetId_fkey" FOREIGN KEY ("stockSheetId") REFERENCES "StockSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabDeadEntry" ADD CONSTRAINT "LabDeadEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
