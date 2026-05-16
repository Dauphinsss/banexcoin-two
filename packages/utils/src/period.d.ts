export interface PeriodDetectionResult {
    period: string | null;
    monthsFound: Array<{
        period: string;
        count: number;
    }>;
    warning: PeriodWarning | null;
}
export type PeriodWarning = {
    type: 'NO_DATES';
    message: string;
} | {
    type: 'MULTIPLE_MONTHS';
    message: string;
    minorityRatio: string;
};
export declare const detectPeriod: (dates: ReadonlyArray<Date | string | null | undefined>) => PeriodDetectionResult;
