import { D, bob, usdt } from './money.js';
export const calculateRebates = (input) => {
    const groups = groupByUser(input.transactions);
    const sortedTiers = [...input.tiers].sort((a, b) => D(a.minAmountBOB).comparedTo(D(b.minAmountBOB)));
    const results = [];
    for (const [userId, userTxs] of groups) {
        const totalSpentBOB = sumBOB(userTxs);
        const totalSpentUSDT = sumUSDT(userTxs);
        const avgRate = avgExchangeRate(totalSpentBOB, totalSpentUSDT);
        const tier = assignTier(totalSpentBOB, sortedTiers);
        const rebateBOB = tier
            ? totalSpentBOB.times(D(tier.rebatePercent)).dividedBy(100)
            : D('0');
        const rebateUSDT = tier
            ? totalSpentUSDT.times(D(tier.rebatePercent)).dividedBy(100)
            : D('0');
        results.push({
            userId,
            totalSpentBOB: bob(totalSpentBOB),
            avgExchangeRate: avgRate,
            tierId: tier?.id ?? null,
            tierName: tier?.name ?? null,
            rebatePercent: tier ? D(tier.rebatePercent).toFixed(2) : '0.00',
            rebateBOB: bob(rebateBOB),
            rebateUSDT: usdt(rebateUSDT),
            transactionCount: userTxs.length,
        });
    }
    return results.sort((a, b) => a.userId - b.userId);
};
const groupByUser = (transactions) => {
    const groups = new Map();
    for (const tx of transactions) {
        const existing = groups.get(tx.userId);
        if (existing) {
            existing.push(tx);
        }
        else {
            groups.set(tx.userId, [tx]);
        }
    }
    return groups;
};
const sumBOB = (transactions) => {
    let total = D('0');
    for (const tx of transactions) {
        total = total.plus(D(tx.amountBOB));
    }
    return total;
};
const sumUSDT = (transactions) => {
    let total = D('0');
    for (const tx of transactions) {
        total = total.plus(D(tx.amountUSDT));
    }
    return total;
};
const avgExchangeRate = (totalSpentBOB, totalSpentUSDT) => {
    if (totalSpentUSDT.isZero())
        return '0.00000000';
    return totalSpentBOB.dividedBy(totalSpentUSDT).toFixed(8);
};
const assignTier = (totalSpent, sortedTiers) => {
    for (const tier of sortedTiers) {
        const min = D(tier.minAmountBOB);
        const max = tier.maxAmountBOB === null ? null : D(tier.maxAmountBOB);
        const aboveMin = totalSpent.greaterThanOrEqualTo(min);
        const belowMax = max === null ? true : totalSpent.lessThanOrEqualTo(max);
        if (aboveMin && belowMax)
            return tier;
    }
    return null;
};
//# sourceMappingURL=tier-engine.js.map
