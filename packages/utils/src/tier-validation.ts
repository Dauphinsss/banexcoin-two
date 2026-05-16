import { D } from './money.js'

/**
 * Validación pura de una configuración de niveles de cashback.
 * Compartida entre backend (endpoint POST /tiers/validate) y frontend (validación inline).
 *
 * Detecta:
 *   - OVERLAP        rangos solapados (bloquea guardado)
 *   - INVERTED_RANGE min > max (bloquea)
 *   - NEGATIVE       valores negativos (bloquea)
 *   - DUPLICATE_LEVEL dos tiers con el mismo `level` (bloquea)
 *   - GAP            hueco entre rangos consecutivos (warning, no bloquea)
 *   - HIGH_PERCENT   rebatePercent > 100 (warning)
 */

export type TierConflictType =
  | 'OVERLAP'
  | 'INVERTED_RANGE'
  | 'NEGATIVE'
  | 'DUPLICATE_LEVEL'
  | 'GAP'
  | 'HIGH_PERCENT'
  | 'NO_OPEN_TOP'

export interface TierConflict {
  type: TierConflictType
  severity: 'error' | 'warning'
  tierIds: Array<string | number>
  message: string
}

export interface TierValidationInput {
  id?: string | number
  level: number
  name: string
  minAmountBOB: string
  maxAmountBOB: string | null | undefined
  rebatePercent: string
}

export interface TierValidationOutput {
  valid: boolean
  conflicts: TierConflict[]
  blockingCount: number
  warningCount: number
}

export const validateTiers = (tiers: readonly TierValidationInput[]): TierValidationOutput => {
  const conflicts: TierConflict[] = []

  if (tiers.length === 0) {
    return { valid: true, conflicts: [], blockingCount: 0, warningCount: 0 }
  }

  // 1. Validación intra-fila
  for (const tier of tiers) {
    const id = tier.id ?? tier.level
    const min = safeDecimal(tier.minAmountBOB)
    const max = tier.maxAmountBOB === null || tier.maxAmountBOB === undefined || tier.maxAmountBOB === ''
      ? null
      : safeDecimal(tier.maxAmountBOB)
    const percent = safeDecimal(tier.rebatePercent)

    if (min === null || (max === null && tier.maxAmountBOB !== null && tier.maxAmountBOB !== undefined && tier.maxAmountBOB !== '') || percent === null) {
      conflicts.push({
        type: 'NEGATIVE',
        severity: 'error',
        tierIds: [id],
        message: `"${tier.name}": valores numéricos inválidos.`,
      })
      continue
    }

    if (min.isNegative() || percent.isNegative() || (max?.isNegative() ?? false)) {
      conflicts.push({
        type: 'NEGATIVE',
        severity: 'error',
        tierIds: [id],
        message: `"${tier.name}": los montos y porcentajes no pueden ser negativos.`,
      })
    }

    if (max !== null && min.greaterThan(max)) {
      conflicts.push({
        type: 'INVERTED_RANGE',
        severity: 'error',
        tierIds: [id],
        message: `"${tier.name}": el mínimo (${min.toFixed(2)}) supera al máximo (${max.toFixed(2)}).`,
      })
    }

    if (percent.greaterThan(100)) {
      conflicts.push({
        type: 'HIGH_PERCENT',
        severity: 'warning',
        tierIds: [id],
        message: `"${tier.name}": cashback del ${percent.toFixed(2)}% supera el 100%.`,
      })
    }
  }

  // 2. Duplicados de level
  const byLevel = new Map<number, Array<string | number>>()
  for (const tier of tiers) {
    const id = tier.id ?? tier.level
    const existing = byLevel.get(tier.level) ?? []
    existing.push(id)
    byLevel.set(tier.level, existing)
  }
  for (const [level, ids] of byLevel) {
    if (ids.length > 1) {
      conflicts.push({
        type: 'DUPLICATE_LEVEL',
        severity: 'error',
        tierIds: ids,
        message: `Nivel ${level} repetido en ${ids.length} configuraciones.`,
      })
    }
  }

  // 3. Solapamientos y huecos — ordenando por minAmountBOB
  const sorted = [...tiers]
    .filter((t) => safeDecimal(t.minAmountBOB) !== null)
    .sort((a, b) => {
      const aMin = safeDecimal(a.minAmountBOB)!
      const bMin = safeDecimal(b.minAmountBOB)!
      return aMin.comparedTo(bMin)
    })

  let openTopCount = 0

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i]!
    const max = tier.maxAmountBOB === null || tier.maxAmountBOB === undefined || tier.maxAmountBOB === ''
      ? null
      : safeDecimal(tier.maxAmountBOB)

    if (max === null) openTopCount += 1

    const next = sorted[i + 1]
    if (!next) continue

    // Si el actual no tiene tope pero hay otro después, solapamos con todo
    if (max === null) {
      conflicts.push({
        type: 'OVERLAP',
        severity: 'error',
        tierIds: [tier.id ?? tier.level, next.id ?? next.level],
        message: `"${tier.name}" no tiene tope superior pero "${next.name}" comienza después; no pueden coexistir.`,
      })
      continue
    }

    const nextMin = safeDecimal(next.minAmountBOB)
    if (nextMin === null) continue

    if (max.greaterThanOrEqualTo(nextMin)) {
      conflicts.push({
        type: 'OVERLAP',
        severity: 'error',
        tierIds: [tier.id ?? tier.level, next.id ?? next.level],
        message: `"${tier.name}" (hasta ${max.toFixed(2)}) se solapa con "${next.name}" (desde ${nextMin.toFixed(2)}).`,
      })
    } else {
      // Hueco: max < next.min - 0.01 deja huecos no cubiertos
      const gap = nextMin.minus(max)
      if (gap.greaterThan(D('0.01'))) {
        conflicts.push({
          type: 'GAP',
          severity: 'warning',
          tierIds: [tier.id ?? tier.level, next.id ?? next.level],
          message: `Hueco entre "${tier.name}" (hasta ${max.toFixed(2)}) y "${next.name}" (desde ${nextMin.toFixed(2)}).`,
        })
      }
    }
  }

  // 4. Falta tier sin tope superior — los gastos altos quedarían sin cobertura
  if (sorted.length > 0 && openTopCount === 0) {
    conflicts.push({
      type: 'NO_OPEN_TOP',
      severity: 'warning',
      tierIds: [],
      message: 'Ningún nivel tiene tope abierto: gastos por encima del máximo no recibirán cashback.',
    })
  }

  const blockingCount = conflicts.filter((c) => c.severity === 'error').length
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length

  return {
    valid: blockingCount === 0,
    conflicts,
    blockingCount,
    warningCount,
  }
}

const safeDecimal = (value: string | null | undefined): import('decimal.js').Decimal | null => {
  if (value === null || value === undefined || value === '') return null
  try {
    return D(value)
  } catch {
    return null
  }
}
