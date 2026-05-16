-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "username" TEXT,
    "accountNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "qrRowCount" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "QRTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "userAccountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactedAt" DATETIME,
    "amountBOB" DECIMAL NOT NULL,
    "amountUSDT" DECIMAL NOT NULL,
    "exchangeRate" DECIMAL NOT NULL,
    "feeBOB" DECIMAL DEFAULT 0,
    "feeUSDT" DECIMAL DEFAULT 0,
    "reconciledWithExtract" BOOLEAN NOT NULL DEFAULT false,
    "rawRow" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QRTransaction_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QRTransaction_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactedAt" DATETIME,
    "amountBOB" DECIMAL NOT NULL,
    "reference" TEXT,
    "rawRow" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractTransaction_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashbackTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "minAmountBOB" DECIMAL NOT NULL,
    "maxAmountBOB" DECIMAL,
    "rebatePercent" DECIMAL NOT NULL,
    "validFromPeriod" TEXT NOT NULL,
    "validToPeriod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyRebate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "userAccountId" TEXT NOT NULL,
    "tierId" TEXT,
    "period" TEXT NOT NULL,
    "totalSpentBOB" DECIMAL NOT NULL,
    "totalSpentUSDT" DECIMAL NOT NULL,
    "avgExchangeRate" DECIMAL NOT NULL,
    "rebatePercent" DECIMAL NOT NULL,
    "rebateBOB" DECIMAL NOT NULL,
    "rebateUSDT" DECIMAL NOT NULL,
    "payoutStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "exported" BOOLEAN NOT NULL DEFAULT false,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyRebate_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyRebate_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyRebate_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CashbackTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReconciliationAnomaly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "qrTransactionId" TEXT,
    "extractTransactionId" TEXT,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qrAmountBOB" DECIMAL,
    "extractAmountBOB" DECIMAL,
    "deltaBOB" DECIMAL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNote" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationAnomaly_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationAnomaly_qrTransactionId_fkey" FOREIGN KEY ("qrTransactionId") REFERENCES "QRTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReconciliationAnomaly_extractTransactionId_fkey" FOREIGN KEY ("extractTransactionId") REFERENCES "ExtractTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParseError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "columnName" TEXT,
    "errorCode" TEXT,
    "message" TEXT NOT NULL,
    "rawRow" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParseError_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyRebateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyRebateId" TEXT NOT NULL,
    "qrTransactionId" TEXT NOT NULL,
    "amountBOB" DECIMAL NOT NULL,
    "amountUSDT" DECIMAL NOT NULL,
    "exchangeRate" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyRebateItem_monthlyRebateId_fkey" FOREIGN KEY ("monthlyRebateId") REFERENCES "MonthlyRebate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyRebateItem_qrTransactionId_fkey" FOREIGN KEY ("qrTransactionId") REFERENCES "QRTransaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "generatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedReport_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_accountNumber_key" ON "UserAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "UserAccount_username_idx" ON "UserAccount"("username");

-- CreateIndex
CREATE INDEX "UserAccount_externalId_idx" ON "UserAccount"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_fileHash_key" ON "Upload"("fileHash");

-- CreateIndex
CREATE INDEX "Upload_period_idx" ON "Upload"("period");

-- CreateIndex
CREATE INDEX "Upload_status_idx" ON "Upload"("status");

-- CreateIndex
CREATE INDEX "Upload_supersedesUploadId_idx" ON "Upload"("supersedesUploadId");

-- CreateIndex
CREATE INDEX "QRTransaction_transactionId_idx" ON "QRTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "QRTransaction_userAccountId_idx" ON "QRTransaction"("userAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "QRTransaction_uploadId_transactionId_key" ON "QRTransaction"("uploadId", "transactionId");

-- CreateIndex
CREATE INDEX "ExtractTransaction_uploadId_idx" ON "ExtractTransaction"("uploadId");

-- CreateIndex
CREATE INDEX "ExtractTransaction_transactionId_idx" ON "ExtractTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "CashbackTier_active_idx" ON "CashbackTier"("active");

-- CreateIndex
CREATE INDEX "CashbackTier_validFromPeriod_validToPeriod_idx" ON "CashbackTier"("validFromPeriod", "validToPeriod");

-- CreateIndex
CREATE INDEX "MonthlyRebate_uploadId_idx" ON "MonthlyRebate"("uploadId");

-- CreateIndex
CREATE INDEX "MonthlyRebate_period_idx" ON "MonthlyRebate"("period");

-- CreateIndex
CREATE INDEX "MonthlyRebate_tierId_idx" ON "MonthlyRebate"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRebate_uploadId_userAccountId_key" ON "MonthlyRebate"("uploadId", "userAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationAnomaly_qrTransactionId_key" ON "ReconciliationAnomaly"("qrTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationAnomaly_extractTransactionId_key" ON "ReconciliationAnomaly"("extractTransactionId");

-- CreateIndex
CREATE INDEX "ReconciliationAnomaly_uploadId_type_idx" ON "ReconciliationAnomaly"("uploadId", "type");

-- CreateIndex
CREATE INDEX "ReconciliationAnomaly_transactionId_idx" ON "ReconciliationAnomaly"("transactionId");

-- CreateIndex
CREATE INDEX "ReconciliationAnomaly_type_resolved_idx" ON "ReconciliationAnomaly"("type", "resolved");

-- CreateIndex
CREATE INDEX "ParseError_uploadId_idx" ON "ParseError"("uploadId");

-- CreateIndex
CREATE INDEX "MonthlyRebateItem_monthlyRebateId_idx" ON "MonthlyRebateItem"("monthlyRebateId");

-- CreateIndex
CREATE INDEX "MonthlyRebateItem_qrTransactionId_idx" ON "MonthlyRebateItem"("qrTransactionId");

-- CreateIndex
CREATE INDEX "GeneratedReport_uploadId_idx" ON "GeneratedReport"("uploadId");

-- CreateIndex
CREATE INDEX "GeneratedReport_type_format_idx" ON "GeneratedReport"("type", "format");
