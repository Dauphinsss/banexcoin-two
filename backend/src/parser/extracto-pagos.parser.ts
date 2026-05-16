import type { Worksheet } from 'exceljs'
import type { ExtractRowRaw, ParseError } from './parser.types'
import { SHEET_EXTRACTO_PAGOS } from './parser.types'

export interface ExtractoPagosOutput {
  rows: ExtractRowRaw[]
  errors: ParseError[]
}

/**
 * Parser de la hoja "EXTRACTO DE PAGOS " (con espacio final).
 *
 * Layout real del Excel:
 *   row 1: vacía
 *   row 2: headers → [None, Fecha, Hora, Codigo de transacción, Importe en bolivianos]
 *   row 3+: datos
 *
 * El importe viene NEGATIVO (representa débito de la cuenta del cliente);
 * lo convertimos a positivo para que cuadre contra "Monto Pagado" de Pago QR,
 * que viene positivo.
 */
export const parseExtractoPagosSheet = (worksheet: Worksheet): ExtractoPagosOutput => {
  const errors: ParseError[] = []
  const rows: ExtractRowRaw[] = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return // skip vacía + headers

    try {
      const parsed = parseRow(row.values, rowNumber)
      if (parsed) rows.push(parsed)
    } catch (error) {
      errors.push({
        sheetName: SHEET_EXTRACTO_PAGOS,
        rowNumber,
        message: error instanceof Error ? error.message : 'Error desconocido',
        rawSnippet: snippet(row.values),
      })
    }
  })

  return { rows, errors }
}

const parseRow = (rawValues: unknown, rowNumber: number): ExtractRowRaw | null => {
  const values = normalizeRowValues(rawValues)

  // Layout: [idx, Fecha, Hora, Codigo, Importe]
  const fecha = values[1]
  const hora = values[2]
  const codigo = values[3]
  const importe = values[4]

  const transactionId = parseTransactionId(codigo)
  if (!transactionId) throw new Error('Código de transacción inválido')

  const amount = parseAmount(importe)
  if (amount === null) throw new Error('Importe en bolivianos inválido')

  const transactedAt = combineFechaHora(fecha, hora)

  return {
    rowNumber,
    transactionId,
    amountBOB: amount,
    transactedAt,
    raw: {
      fecha: fecha ?? null,
      hora: hora ?? null,
      codigo: codigo ?? null,
      importe: importe ?? null,
    },
  }
}

const parseTransactionId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isInteger(value)) return value.toString()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return null
}

const parseAmount = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value).toString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.')
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
    const num = Math.abs(Number(trimmed))
    return num.toString()
  }
  return null
}

const combineFechaHora = (fecha: unknown, hora: unknown): Date | null => {
  let date: Date | null = null
  if (fecha instanceof Date) {
    date = new Date(fecha.getTime())
  } else if (typeof fecha === 'string') {
    const parsed = new Date(fecha)
    date = Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (!date) return null

  if (hora && typeof hora === 'object' && 'getHours' in (hora as object)) {
    const h = hora as Date
    date.setUTCHours(h.getUTCHours(), h.getUTCMinutes(), h.getUTCSeconds(), 0)
  } else if (typeof hora === 'string') {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hora.trim())
    if (match) {
      const [, hh, mm, ss] = match
      date.setUTCHours(Number(hh), Number(mm), Number(ss ?? '0'), 0)
    }
  }

  return date
}

const normalizeRowValues = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw[0] === undefined || raw[0] === null ? raw.slice(1) : [...raw]
  }
  return []
}

const snippet = (rawValues: unknown): string => {
  const values = normalizeRowValues(rawValues)
  return values
    .slice(0, 5)
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(' | ')
    .slice(0, 200)
}
