import type { DecimalString } from './money.js';
export interface MonthlyRebateDTO {
    id: string;
    uploadId: string;
    userId: number;
    username: string;
    period: string;
    totalSpentBOB: DecimalString;
    tierId: number | null;
    tierName: string | null;
    rebatePercent: DecimalString;
    rebateUSDT: DecimalString;
    rebateBOB: DecimalString;
    avgExchangeRate: DecimalString;
    paidOut: boolean;
    paidOutAt: string | null;
    transactionCount: number;
}
export interface RebateSummary {
    period: string;
    totalRebateUSDT: DecimalString;
    totalRebateBOB: DecimalString;
    userCount: number;
    anomalyCount: number;
    averageTicketBOB: DecimalString;
    tierDistribution: Array<{
        tierId: number | null;
        tierName: string;
        userCount: number;
        totalRebateUSDT: DecimalString;
    }>;
}
