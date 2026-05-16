/**
 * Helpers de formato monetario para la UI.
 *
 * Recibe strings (los DTOs entregan strings con precisión decimal completa)
 * y devuelve strings listos para mostrar. CONVENTIONS.md sección 1.4.
 */

const bobFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdtFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
})

const usdtCompactFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const integerFormatter = new Intl.NumberFormat('es-BO', {
  maximumFractionDigits: 0,
})

export const formatBOB = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return 'Bs 0.00'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return 'Bs 0.00'
  return `Bs ${bobFormatter.format(num)}`
}

export const formatUSDT = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00 USDT'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return '0.00 USDT'
  return `${usdtFormatter.format(num)} USDT`
}

export const formatUSDTCompact = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return '0.00'
  return usdtCompactFormatter.format(num)
}

export const formatPercent = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00%'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return '0.00%'
  return `${num.toFixed(2)}%`
}

export const formatInteger = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0'
  return integerFormatter.format(value)
}

export const formatRate = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.0000'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return '0.0000'
  return num.toFixed(4)
}

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Etiquetas legibles para los tipos de anomalía detectados por ReconcileAgent.
 */
export const ANOMALY_LABELS: Record<string, { label: string; color: string }> = {
  NO_EXTRACT: { label: 'Sin extracto', color: 'red' },
  NO_QR: { label: 'Sin pago QR', color: 'amber' },
  AMOUNT_MISMATCH: { label: 'Monto difiere', color: 'orange' },
  INVALID_RATE: { label: 'Tasa inválida', color: 'purple' },
}
