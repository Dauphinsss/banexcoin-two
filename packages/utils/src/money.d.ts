import { Decimal } from 'decimal.js';
import type { DecimalString } from "@banex/types";
export declare const D: (value: DecimalString | number | Decimal) => Decimal;
export declare const bob: (value: DecimalString | number | Decimal) => DecimalString;
export declare const usdt: (value: DecimalString | number | Decimal) => DecimalString;
export declare const formatBOB: (value: DecimalString | Decimal) => string;
export declare const formatUSDT: (value: DecimalString | Decimal) => string;
export declare const formatPercent: (value: DecimalString | Decimal) => string;
export declare const isCloseTo: (a: DecimalString | Decimal, b: DecimalString | Decimal, tolerance?: DecimalString | Decimal) => boolean;
export declare const weightedAverage: (pairs: Array<{
    value: DecimalString | Decimal;
    weight: DecimalString | Decimal;
}>) => DecimalString;
