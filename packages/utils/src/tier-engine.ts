import { Decimal } from 'decimal.js'
import type { DecimalString } from '@banex/types'
import { D, bob, usdt, weightedAverage } from './money.js'

export interface TierEngineTransaction {
  userId: number
  amountBOB: DecimalString
  amountUSDT: DecimalString
  exchangeRate: DecimalString
}

export interface TierEngineTier {
  id: number
  name: string
  minAmountBOB: DecimalString
  maxAmountBOB: DecimalString | null
  rebatePercent: DecimalString
}

export interface TierEngineInput {
  transactions: readonly TierEngineTransaction[]
  tiers: readonly TierEngineTier[]
}

export interface RebateResult {
  userId: number
  totalSpentBOB: DecimalString
  avgExchangeRate: DecimalString
  tierId: number | null
  tierName: string | null
  rebatePercent: DecimalString
  rebateBOB: DecimalString
  rebateUSDT: DecimalString
  transactionCount: number
}

/**
 * Calcula los reintegros mensuales por usuario.
 *
 * Reglas (ver FLOW.md sección 5 y CONVENTIONS.md sección 1):
 * - Todos los valores monetarios viajan como strings y se operan con decimal.js.
 * - El tipo de cambio aplicado al reintegro en USDT es el promedio ponderado
 *   por monto BOB del mes, no la tasa del día de pago.
 * - Un usuario cae en un único tier (rango cerrado: min <= total <= max).
 * - Si el total no cae en ningún tier, devuelve tierId=null y rebate 0.
 * - El input no se muta; la función es pura.
 */
export const calculateRebates = (input: TierEngineInput): RebateResult[] => {
  const groups = groupByUser(input.transactions)
  const sortedTiers = [...input.tiers].sort((a, b) =>
    D(a.minAmountBOB).comparedTo(D(b.minAmountBOB)),
  )

  const results: RebateResult[] = []

  for (const [userId, userTxs] of groups) {
    const totalSpent = sumBOB(userTxs)
    const avgRate = avgExchangeRate(userTxs)
    const tier = assignTier(totalSpent, sortedTiers)

    const rebateBOB = tier
      ? totalSpent.times(D(tier.rebatePercent)).dividedBy(100)
      : D('0')

    const rebateUSDT = tier && !D(avgRate).isZero()
      ? rebateBOB.dividedBy(D(avgRate))
      : D('0')

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
    })
  }

  return results.sort((a, b) => a.userId - b.userId)
}

const groupByUser = (
  transactions: readonly TierEngineTransaction[],
): Map<number, TierEngineTransaction[]> => {
  const groups = new Map<number, TierEngineTransaction[]>()
  for (const tx of transactions) {
    const existing = groups.get(tx.userId)
    if (existing) {
      existing.push(tx)
    } else {
      groups.set(tx.userId, [tx])
    }
  }
  return groups
}

const sumBOB = (transactions: readonly TierEngineTransaction[]): Decimal => {
  let total = D('0')
  for (const tx of transactions) {
    total = total.plus(D(tx.amountBOB))
  }
  return total
}

const avgExchangeRate = (
  transactions: readonly TierEngineTransaction[],
): DecimalString =>
  weightedAverage(
    transactions.map((tx) => ({
      value: tx.exchangeRate,
      weight: tx.amountBOB,
    })),
  )

/**
 * Asigna el tier con rangos cerrados [min, max].
 * Si maxAmountBOB es null, el tier no tiene tope superior.
 * Espera tiers pre-ordenados ascendentemente por minAmountBOB.
 */
const assignTier = (
  totalSpent: Decimal,
  sortedTiers: readonly TierEngineTier[],
): TierEngineTier | null => {
  for (const tier of sortedTiers) {
    const min = D(tier.minAmountBOB)
    const max = tier.maxAmountBOB === null ? null : D(tier.maxAmountBOB)

    const aboveMin = totalSpent.greaterThanOrEqualTo(min)
    const belowMax = max === null ? true : totalSpent.lessThanOrEqualTo(max)

    if (aboveMin && belowMax) return tier
  }
  return null
}
