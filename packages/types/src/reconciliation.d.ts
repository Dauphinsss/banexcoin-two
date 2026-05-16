import type { DecimalString } from './money.js';
export type AnomalyType = 'NO_EXTRACT' | 'NO_QR' | 'AMOUNT_MISMATCH' | 'INVALID_RATE';
export interface AnomalyDTO {
    id: string;
    uploadId: string;
    transactionId: string;
    type: AnomalyType;
    qrAmountBOB: DecimalString | null;
    extractAmountBOB: DecimalString | null;
    deltaBOB: DecimalString | null;
    resolved: boolean;
    resolvedAt: string | null;
    resolvedNote: string | null;
}
export interface ReconciliationStats {
    uploadId: string;
    total: number;
    noExtract: number;
    noQr: number;
    amountMismatch: number;
    invalidRate: number;
    reconciliationRate: DecimalString;
}
