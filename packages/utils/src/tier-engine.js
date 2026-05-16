import { D, bob, usdt, weightedAverage } from './money.js';
export const calculateRebates = (input) => {
    const groups = groupByUser(input.transactions);
    const sortedTiers = [...input.tiers].sort((a, b) => D(a.minAmountBOB).comparedTo(D(b.minAmountBOB)));
    const results = [];
    for (const [userId, userTxs] of groups) {
        const totalSpent = sumBOB(userTxs);
        const avgRate = avgExchangeRate(userTxs);
        const tier = assignTier(totalSpent, sortedTiers);
        const rebateBOB = tier
            ? totalSpent.times(D(tier.rebatePercent)).dividedBy(100)
            : D('0');
        const rebateUSDT = tier && !D(avgRate).isZero()
            ? rebateBOB.dividedBy(D(avgRate))
            : D('0');
        results.push({
            userId,
            totalSpentBOB: bob(totalSpent),
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
const avgExchangeRate = (transactions) => weightedAverage(transactions.map((tx) => ({
    value: tx.exchangeRate,
    weight: tx.amountBOB,
})));
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