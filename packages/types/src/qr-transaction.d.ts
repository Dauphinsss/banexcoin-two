import type { DecimalString } from './money.js';
export interface QRTransactionDTO {
    id: string;
    uploadId: string;
    userId: number;
    username: string;
    accountNumber: number;
    transactionId: string;
    status: string;
    amountUSDT: DecimalString;
    amountBOB: DecimalString;
    exchangeRate: DecimalString;
    commission: DecimalString;
    transactedAt: string;
    reconciledWithExtract: boolean;
    extractMismatch: string | null;
}
