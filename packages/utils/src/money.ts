import { Decimal } from 'decimal.js'
import type { DecimalString } from '../../types/dist/index.js'

/**
 * Configuración global de decimal.js para todo el motor financiero.
 *
 * Banker's rounding (ROUND_HALF_EVEN) es el estándar financiero internacional:
 * reduce el sesgo acumulado en operaciones masivas vs ROUND_HALF_UP.
 * Ver CONVENTIONS.md sección 1.3.
 */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -20,
  toExpPos: 30,
})

/**
 * Constructor seguro de Decimal desde string.
 * Lanza error explícito si la entrada no es parseable, en lugar de devolver NaN.
 */
export const D = (value: DecimalString | number | Decimal): Decimal => {
  if (value instanceof Decimal) return value
  const dec = new Decimal(value)
  if (dec.isNaN()) {
    throw new Error(`Invalid decimal value: ${String(value)}`)
  }
  return dec
}

/**
 * Helper específico para montos BOB (2 decimales).
 * Devuelve string con 2 decimales fijos para persistencia y display.
 */
export const bob = (value: DecimalString | number | Decimal): DecimalString =>
  D(value).toFixed(2)

/**
 * Helper específico para montos USDT (8 decimales).
 */
export const usdt = (value: DecimalString | number | Decimal): DecimalString =>
  D(value).toFixed(8)

const numberFormatBOB = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatUSDT = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 8,
  maximumFractionDigits: 8,
})

export const formatBOB = (value: DecimalString | Decimal): string => {
  const dec = D(value)
  return `Bs ${numberFormatBOB.format(dec.toNumber())}`
}

export const formatUSDT = (value: DecimalString | Decimal): string => {
  const dec = D(value)
  return `${numberFormatUSDT.format(dec.toNumber())} USDT`
}

export const formatPercent = (value: DecimalString | Decimal): string => {
  return `${D(value).toFixed(2)}%`
}

/**
 * Compara dos decimales con tolerancia explícita.
 * Necesario porque la igualdad estricta en decimales financieros es frágil
 * (ej. tasas de cambio que difieren en el 8º decimal por redondeo de origen).
 */
export const isCloseTo = (
  a: DecimalString | Decimal,
  b: DecimalString | Decimal,
  tolerance: DecimalString | Decimal = '0.01',
): boolean => D(a).minus(D(b)).abs().lessThanOrEqualTo(D(tolerance))

/**
 * Promedio ponderado: Σ(value × weight) / Σ(weight).
 * Si la suma de pesos es cero, devuelve '0' (no NaN ni error — política financiera).
 */
export const weightedAverage = (
  pairs: Array<{ value: DecimalString | Decimal; weight: DecimalString | Decimal }>,
): DecimalString => {
  if (pairs.length === 0) return '0'

  let weightedSum = D('0')
  let weightSum = D('0')

  for (const pair of pairs) {
    const value = D(pair.value)
    const weight = D(pair.weight)
    weightedSum = weightedSum.plus(value.times(weight))
    weightSum = weightSum.plus(weight)
  }

  if (weightSum.isZero()) return '0'

  return weightedSum.dividedBy(weightSum).toFixed(8)
}
