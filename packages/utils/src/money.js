import { Decimal } from 'decimal.js';
Decimal.set({
    precision: 40,
    rounding: Decimal.ROUND_HALF_EVEN,
    toExpNeg: -20,
    toExpPos: 30,
});
export const D = (value) => {
    if (value instanceof Decimal)
        return value;
    let dec;
    try {
        dec = new Decimal(value);
    }
    catch {
        throw new Error(`Invalid decimal value: ${String(value)}`);
    }
    if (dec.isNaN())
        throw new Error(`Invalid decimal value: ${String(value)}`);
    return dec;
};
export const bob = (value) => D(value).toFixed(2);
export const usdt = (value) => D(value).toFixed(8);
const numberFormatBOB = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
export const formatBOB = (value) => {
    const dec = D(value);
    return `Bs ${numberFormatBOB.format(dec.toNumber())}`;
};
export const formatUSDT = (value) => {
    return `${D(value).toFixed(8)} USDT`;
};
export const formatPercent = (value) => {
    return `${D(value).toFixed(2)}%`;
};
export const isCloseTo = (a, b, tolerance = '0.01') => D(a).minus(D(b)).abs().lessThanOrEqualTo(D(tolerance));
export const weightedAverage = (pairs) => {
    if (pairs.length === 0)
        return '0';
    let weightedSum = D('0');
    let weightSum = D('0');
    for (const pair of pairs) {
        const value = D(pair.value);
        const weight = D(pair.weight);
        weightedSum = weightedSum.plus(value.times(weight));
        weightSum = weightSum.plus(weight);
    }
    if (weightSum.isZero())
        return '0';
    return weightedSum.dividedBy(weightSum).toFixed(8);
};
//# sourceMappingURL=money.js.map
