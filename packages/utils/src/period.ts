/**
 * Detección del período "YYYY-MM" predominante en un conjunto de fechas.
 * Si más de un mes aparece, se advierte para que el usuario confirme cuál procesar.
 */

export interface PeriodDetectionResult {
  period: string | null
  monthsFound: Array<{ period: string; count: number }>
  warning: PeriodWarning | null
}

export type PeriodWarning =
  | { type: 'NO_DATES'; message: string }
  | { type: 'MULTIPLE_MONTHS'; message: string; minorityRatio: string }

/**
 * Devuelve el período (YYYY-MM) más frecuente.
 * Si la fracción minoritaria supera el 10%, emite warning MULTIPLE_MONTHS.
 */
export const detectPeriod = (
  dates: ReadonlyArray<Date | string | null | undefined>,
): PeriodDetectionResult => {
  const counts = new Map<string, number>()
  let totalValid = 0

  for (const raw of dates) {
    const date = toDate(raw)
    if (!date) continue
    const key = monthKey(date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    totalValid += 1
  }

  if (totalValid === 0) {
    return {
      period: null,
      monthsFound: [],
      warning: {
        type: 'NO_DATES',
        message: 'No se pudieron leer fechas válidas del archivo.',
      },
    }
  }

  const monthsFound = [...counts.entries()]
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => b.count - a.count)

  const top = monthsFound[0]
  if (!top) {
    return { period: null, monthsFound: [], warning: null }
  }

  const minority = totalValid - top.count
  const minorityRatio = minority / totalValid

  let warning: PeriodWarning | null = null
  if (monthsFound.length > 1 && minorityRatio > 0.1) {
    warning = {
      type: 'MULTIPLE_MONTHS',
      message: `El archivo cubre ${monthsFound.length} meses. El mes mayoritario es ${top.period}, pero el ${(minorityRatio * 100).toFixed(1)}% de las filas pertenecen a otros meses.`,
      minorityRatio: minorityRatio.toFixed(4),
    }
  }

  return { period: top.period, monthsFound, warning }
}

const toDate = (raw: Date | string | null | undefined): Date | null => {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw
  }
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Soporta "DD/MM/YYYY HH:MM:SS, UTC -04:00" y similar
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const monthKey = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
