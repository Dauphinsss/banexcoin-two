import type { DecimalString } from './money.js';
export interface CashbackTierDTO {
    id: number;
    name: string;
    minAmountBOB: DecimalString;
    maxAmountBOB: DecimalString | null;
    rebatePercent: DecimalString;
    active: boolean;
    validFrom: string;
    validTo: string | null;
}
export interface TierValidationResult {
    valid: boolean;
    conflicts: Array<{
        type: 'OVERLAP' | 'GAP' | 'INVERTED_RANGE' | 'NEGATIVE_PERCENT';
        tierIds: number[];
        message: string;
    }>;
}
