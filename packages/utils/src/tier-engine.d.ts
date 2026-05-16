import type { DecimalString } from "@banex/types";
export interface TierEngineTransaction {
    userId: number;
    amountBOB: DecimalString;
    amountUSDT: DecimalString;
    exchangeRate: DecimalString;
}
export interface TierEngineTier {
    id: number;
    name: string;
    minAmountBOB: DecimalString;
    maxAmountBOB: DecimalString | null;
    rebatePercent: DecimalString;
}
export interface TierEngineInput {
    transactions: readonly TierEngineTransaction[];
    tiers: readonly TierEngineTier[];
}
export interface RebateResult {
    userId: number;
    totalSpentBOB: DecimalString;
    avgExchangeRate: DecimalString;
    tierId: number | null;
    tierName: string | null;
    rebatePercent: DecimalString;
    rebateBOB: DecimalString;
    rebateUSDT: DecimalString;
    transactionCount: number;
}
export declare const calculateRebates: (input: TierEngineInput) => RebateResult[];
