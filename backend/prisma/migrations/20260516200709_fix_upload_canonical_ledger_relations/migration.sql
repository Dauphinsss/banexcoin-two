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
    CONSTRAINT "MonthlyRebateItem_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyRebateItem" ("amountBOB", "amountUSDT", "createdAt", "exchangeRate", "id", "ledgerTransactionId", "monthlyRebateId") SELECT "amountBOB", "amountUSDT", "createdAt", "exchangeRate", "id", "ledgerTransactionId", "monthlyRebateId" FROM "MonthlyRebateItem";
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
    CONSTRAINT "ReconciliationAnomaly_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationAnomaly_bankExtractEntryId_fkey" FOREIGN KEY ("bankExtractEntryId") REFERENCES "BankExtractEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReconciliationAnomaly" ("bankExtractEntryId", "createdAt", "deltaBOB", "extractAmountBOB", "id", "ledgerAmountBOB", "ledgerTransactionId", "resolutionNote", "resolved", "resolvedAt", "serviceCode", "transactionId", "type", "uploadId") SELECT "bankExtractEntryId", "createdAt", "deltaBOB", "extractAmountBOB", "id", "ledgerAmountBOB", "ledgerTransactionId", "resolutionNote", "resolved", "resolvedAt", "serviceCode", "transactionId", "type", "uploadId" FROM "ReconciliationAnomaly";
DROP TABLE "ReconciliationAnomaly";
ALTER TABLE "new_ReconciliationAnomaly" RENAME TO "ReconciliationAnomaly";
CREATE INDEX "ReconciliationAnomaly_uploadId_type_idx" ON "ReconciliationAnomaly"("uploadId", "type");
CREATE INDEX "ReconciliationAnomaly_transactionId_idx" ON "ReconciliationAnomaly"("transactionId");
CREATE INDEX "ReconciliationAnomaly_serviceCode_idx" ON "ReconciliationAnomaly"("serviceCode");
CREATE INDEX "ReconciliationAnomaly_type_resolved_idx" ON "ReconciliationAnomaly"("type", "resolved");
CREATE INDEX "ReconciliationAnomaly_ledgerTransactionId_idx" ON "ReconciliationAnomaly"("ledgerTransactionId");
CREATE INDEX "ReconciliationAnomaly_bankExtractEntryId_idx" ON "ReconciliationAnomaly"("bankExtractEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
