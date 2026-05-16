import { Decimal } from 'decimal.js'
import type { DecimalString } from '../../types/dist/index.js'
import { D, bob, usdt } from './money.js'

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
 * - El índice para categorizar usuarios es el consumo mensual total en BOB.
 * - El reintegro en USDT se calcula sobre el consumo USDT histórico del Excel.
 * - El tipo de cambio promedio auditado se deduce como totalBOB / totalUSDT.
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
    const totalSpentBOB = sumBOB(userTxs)
    const totalSpentUSDT = sumUSDT(userTxs)
    const avgRate = avgExchangeRate(totalSpentBOB, totalSpentUSDT)
    const tier = assignTier(totalSpentBOB, sortedTiers)

    const rebateBOB = tier
      ? totalSpentBOB.times(D(tier.rebatePercent)).dividedBy(100)
      : D('0')

    const rebateUSDT = tier
      ? totalSpentUSDT.times(D(tier.rebatePercent)).dividedBy(100)
      : D('0')

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

const sumUSDT = (transactions: readonly TierEngineTransaction[]): Decimal => {
  let total = D('0')
  for (const tx of transactions) {
    total = total.plus(D(tx.amountUSDT))
  }
  return total
}

const avgExchangeRate = (
  totalSpentBOB: Decimal,
  totalSpentUSDT: Decimal,
): DecimalString => {
  if (totalSpentUSDT.isZero()) return '0.00000000'
  return totalSpentBOB.dividedBy(totalSpentUSDT).toFixed(8)
}

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
