/*
  Warnings:

  - You are about to drop the `ExtractTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QRTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `qrTransactionId` on the `MonthlyRebateItem` table. All the data in the column will be lost.
  - You are about to drop the column `extractTransactionId` on the `ReconciliationAnomaly` table. All the data in the column will be lost.
  - You are about to drop the column `qrAmountBOB` on the `ReconciliationAnomaly` table. All the data in the column will be lost.
  - You are about to drop the column `qrTransactionId` on the `ReconciliationAnomaly` table. All the data in the column will be lost.
  - You are about to drop the column `qrRowCount` on the `Upload` table. All the data in the column will be lost.
  - Added the required column `ledgerTransactionId` to the `MonthlyRebateItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ExtractTransaction_transactionId_idx";

-- DropIndex
DROP INDEX "ExtractTransaction_uploadId_idx";

-- DropIndex
DROP INDEX "QRTransaction_uploadId_transactionId_key";

-- DropIndex
DROP INDEX "QRTransaction_userAccountId_idx";

-- DropIndex
DROP INDEX "QRTransaction_transactionId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExtractTransaction";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "QRTransaction";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "userAccountId" TEXT,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT,
    "sourceSheet" TEXT NOT NULL,
    "sourceRowNumber" INTEGER,
    "transactionId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "status" TEXT,
    "direction" TEXT,
    "productSymbol" TEXT,
    "blockchain" TEXT,
    "amountBOB" DECIMAL,
    "amountUSDT" DECIMAL,
    "feeBOB" DECIMAL DEFAULT 0,
    "feeUSDT" DECIMAL DEFAULT 0,
    "netAmountBOB" DECIMAL,
    "netAmountUSDT" DECIMAL,
    "exchangeRate" DECIMAL,
    "transactedAt" DATETIME,
    "reconciledWithExtract" BOOLEAN NOT NULL DEFAULT false,
    "rawRow" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerTransaction_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LedgerTransaction_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QrTransactionDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerTransactionId" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "sideClient" TEXT,
    "currencyCode" TEXT,
    "paidAmountBOB" DECIMAL,
    "exchangedAmountUSDT" DECIMAL,
    "createdAtSource" DATETIME,
    "updatedAtSource" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrTransactionDetail_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerTransactionId" TEXT NOT NULL,
    "transferNumber" TEXT,
    "senderUserAccountId" TEXT,
    "receiverUserAccountId" TEXT,
    "senderAlias" TEXT,
    "receiverAlias" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferDetail_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferDetail_senderUserAccountId_fkey" FOREIGN KEY ("senderUserAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferDetail_receiverUserAccountId_fkey" FOREIGN KEY ("receiverUserAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankExtractEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "extractKind" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceRowNumber" INTEGER,
    "transactionId" TEXT NOT NULL,
    "transactedAt" DATETIME,
    "amountBOB" DECIMAL NOT NULL,
    "rawRow" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankExtractEntry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonthlyRebateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyRebateId" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "amountBOB" DECIMAL NOT NULL,
    "amountUSDT" DECIMAL NOT NULL,
    "exchangeRate" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyRebateItem_monthlyRebateId_fkey" FOREIGN KEY ("monthlyRebateId") REFERENCES "MonthlyRebate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyRebateItem_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyRebateItem" ("amountBOB", "amountUSDT", "createdAt", "exchangeRate", "id", "monthlyRebateId") SELECT "amountBOB", "amountUSDT", "createdAt", "exchangeRate", "id", "monthlyRebateId" FROM "MonthlyRebateItem";
DROP TABLE "MonthlyRebateItem";
ALTER TABLE "new_MonthlyRebateItem" RENAME TO "MonthlyRebateItem";
CREATE INDEX "MonthlyRebateItem_monthlyRebateId_idx" ON "MonthlyRebateItem"("monthlyRebateId");
CREATE INDEX "MonthlyRebateItem_ledgerTransactionId_idx" ON "MonthlyRebateItem"("ledgerTransactionId");
CREATE TABLE "new_ReconciliationAnomaly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "ledgerTransactionId" TEXT,
    "bankExtractEntryId" TEXT,
    "transactionId" TEXT NOT NULL,
    "serviceCode" TEXT,
    "type" TEXT NOT NULL,
    "ledgerAmountBOB" DECIMAL,
    "extractAmountBOB" DECIMAL,
    "deltaBOB" DECIMAL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNote" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationAnomaly_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationAnomaly_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationAnomaly_bankExtractEntryId_fkey" FOREIGN KEY ("bankExtractEntryId") REFERENCES "BankExtractEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReconciliationAnomaly" ("createdAt", "deltaBOB", "extractAmountBOB", "id", "resolutionNote", "resolved", "resolvedAt", "transactionId", "type", "uploadId") SELECT "createdAt", "deltaBOB", "extractAmountBOB", "id", "resolutionNote", "resolved", "resolvedAt", "transactionId", "type", "uploadId" FROM "ReconciliationAnomaly";
DROP TABLE "ReconciliationAnomaly";
ALTER TABLE "new_ReconciliationAnomaly" RENAME TO "ReconciliationAnomaly";
CREATE INDEX "ReconciliationAnomaly_uploadId_type_idx" ON "ReconciliationAnomaly"("uploadId", "type");
CREATE INDEX "ReconciliationAnomaly_transactionId_idx" ON "ReconciliationAnomaly"("transactionId");
CREATE INDEX "ReconciliationAnomaly_serviceCode_idx" ON "ReconciliationAnomaly"("serviceCode");
CREATE INDEX "ReconciliationAnomaly_type_resolved_idx" ON "ReconciliationAnomaly"("type", "resolved");
CREATE INDEX "ReconciliationAnomaly_ledgerTransactionId_idx" ON "ReconciliationAnomaly"("ledgerTransactionId");
CREATE INDEX "ReconciliationAnomaly_bankExtractEntryId_idx" ON "ReconciliationAnomaly"("bankExtractEntryId");
CREATE TABLE "new_Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "transactionRowCount" INTEGER NOT NULL DEFAULT 0,
    "extractRowCount" INTEGER NOT NULL DEFAULT 0,
    "parseErrorCount" INTEGER NOT NULL DEFAULT 0,
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "supersedesUploadId" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Upload_supersedesUploadId_fkey" FOREIGN KEY ("supersedesUploadId") REFERENCES "Upload" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Upload" ("anomalyCount", "createdAt", "errorMessage", "extractRowCount", "fileHash", "fileSizeBytes", "id", "mimeType", "originalName", "parseErrorCount", "period", "processedAt", "rowCount", "status", "storagePath", "supersedesUploadId", "updatedAt") SELECT "anomalyCount", "createdAt", "errorMessage", "extractRowCount", "fileHash", "fileSizeBytes", "id", "mimeType", "originalName", "parseErrorCount", "period", "processedAt", "rowCount", "status", "storagePath", "supersedesUploadId", "updatedAt" FROM "Upload";
DROP TABLE "Upload";
ALTER TABLE "new_Upload" RENAME TO "Upload";
CREATE UNIQUE INDEX "Upload_fileHash_key" ON "Upload"("fileHash");
CREATE INDEX "Upload_period_idx" ON "Upload"("period");
CREATE INDEX "Upload_status_idx" ON "Upload"("status");
CREATE INDEX "Upload_supersedesUploadId_idx" ON "Upload"("supersedesUploadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LedgerTransaction_transactionId_idx" ON "LedgerTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_userAccountId_idx" ON "LedgerTransaction"("userAccountId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_serviceCode_idx" ON "LedgerTransaction"("serviceCode");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sourceSheet_idx" ON "LedgerTransaction"("sourceSheet");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_uploadId_serviceCode_transactionId_key" ON "LedgerTransaction"("uploadId", "serviceCode", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "QrTransactionDetail_ledgerTransactionId_key" ON "QrTransactionDetail"("ledgerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferDetail_ledgerTransactionId_key" ON "TransferDetail"("ledgerTransactionId");

-- CreateIndex
CREATE INDEX "TransferDetail_senderUserAccountId_idx" ON "TransferDetail"("senderUserAccountId");

-- CreateIndex
CREATE INDEX "TransferDetail_receiverUserAccountId_idx" ON "TransferDetail"("receiverUserAccountId");

-- CreateIndex
CREATE INDEX "BankExtractEntry_uploadId_idx" ON "BankExtractEntry"("uploadId");

-- CreateIndex
CREATE INDEX "BankExtractEntry_transactionId_idx" ON "BankExtractEntry"("transactionId");

-- CreateIndex
CREATE INDEX "BankExtractEntry_sourceSheet_idx" ON "BankExtractEntry"("sourceSheet");
