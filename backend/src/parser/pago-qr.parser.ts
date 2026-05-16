import type { Worksheet } from 'exceljs'
import type { ParseError, QRTransactionRaw } from './parser.types'
import { REQUIRED_PAGO_QR_HEADERS, SHEET_PAGO_QR } from './parser.types'

interface ColumnIndex {
  quoteNumber: number
  createdAt: number
  status: number
  createdBy: number
  accountNumber: number
  amountUSDT: number
  amountBOB: number
  exchangeRate: number
  commission: number
  transactionId: number
  serviceCode: number
}

export interface PagoQRParseOutput {
  rows: QRTransactionRaw[]
  errors: ParseError[]
}

/**
 * Parser de la hoja "Pago QR".
 *
 * Convenciones:
 * - row 1 contiene los headers
 * - filas inválidas se acumulan en `errors[]` sin abortar
 * - si faltan headers obligatorios, devuelve un solo error y rows vacío
 */
export const parsePagoQRSheet = (worksheet: Worksheet): PagoQRParseOutput => {
  const errors: ParseError[] = []
  const headerRow = worksheet.getRow(1)
  const indices = mapColumns(headerRow.values)

  const missing = checkMissingHeaders(headerRow.values)
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          sheetName: SHEET_PAGO_QR,
          rowNumber: 1,
          message: `Faltan columnas obligatorias: ${missing.join(', ')}`,
          rawSnippet: null,
        },
      ],
    }
  }

  const rows: QRTransactionRaw[] = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return

    try {
      const parsed = parseRow(row.values, rowNumber, indices)
      if (parsed) rows.push(parsed)
    } catch (error) {
      errors.push({
        sheetName: SHEET_PAGO_QR,
        rowNumber,
        message: error instanceof Error ? error.message : 'Error desconocido',
        rawSnippet: snippet(row.values),
      })
    }
  })

  return { rows, errors }
}

const parseRow = (
  rawValues: unknown,
  rowNumber: number,
  idx: ColumnIndex,
): QRTransactionRaw | null => {
  const values = normalizeRowValues(rawValues)

  const transactionId = requireString(values[idx.transactionId], 'Transacción Id')
  const username = requireString(values[idx.createdBy], 'Creado por')
  const accountNumber = requireInt(values[idx.accountNumber], 'Número de Cuenta')
  const amountUSDT = requirePositiveDecimal(values[idx.amountUSDT], 'Monto intercambio')
  const amountBOB = requirePositiveDecimal(values[idx.amountBOB], 'Monto Pagado')
  const exchangeRate = requirePositiveDecimal(values[idx.exchangeRate], 'Precio')

  const commission = idx.commission > 0
    ? optionalDecimal(values[idx.commission]) ?? '0'
    : '0'
  const status = idx.status > 0 ? optionalString(values[idx.status]) ?? 'Unknown' : 'Unknown'
  const serviceCode = idx.serviceCode > 0
    ? optionalString(values[idx.serviceCode]) ?? 'S-001'
    : 'S-001'
  const quoteNumber = idx.quoteNumber > 0
    ? optionalInt(values[idx.quoteNumber])
    : null
  const transactedAt = idx.createdAt > 0
    ? optionalDate(values[idx.createdAt])
    : null

  return {
    rowNumber,
    transactionId,
    username,
    accountNumber,
    amountUSDT,
    amountBOB,
    exchangeRate,
    commission,
    status,
    serviceCode,
    quoteNumber,
    transactedAt,
    raw: collectRawValues(values, idx),
  }
}

const mapColumns = (rawHeaders: unknown): ColumnIndex => {
  const headers = normalizeRowValues(rawHeaders).map((v) =>
    typeof v === 'string' ? v.trim() : '',
  )

  const findIdx = (name: string): number => {
    const i = headers.findIndex((h) => h === name)
    return i >= 0 ? i : -1
  }

  return {
    quoteNumber: findIdx('Número de cotización'),
    createdAt: findIdx('Fecha de creación'),
    status: findIdx('Estado'),
    createdBy: findIdx('Creado por'),
    accountNumber: findIdx('Número de Cuenta'),
    amountUSDT: findIdx('Monto intercambio'),
    amountBOB: findIdx('Monto Pagado'),
    exchangeRate: findIdx('Precio'),
    commission: findIdx('Comisión'),
    transactionId: findIdx('Transacción Id'),
    serviceCode: findIdx('Tipo de servicio'),
  }
}

const checkMissingHeaders = (rawHeaders: unknown): string[] => {
  const headers = new Set(
    normalizeRowValues(rawHeaders)
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean),
  )
  return REQUIRED_PAGO_QR_HEADERS.filter((h) => !headers.has(h))
}

/**
 * exceljs entrega row.values con el índice 0 vacío (usa indexado 1-based).
 * Esta función devuelve un array 0-based limpio.
 */
const normalizeRowValues = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw[0] === undefined || raw[0] === null ? raw.slice(1) : [...raw]
  }
  return []
}

const requireString = (value: unknown, fieldName: string): string => {
  const str = optionalString(value)
  if (!str) throw new Error(`Campo "${fieldName}" vacío`)
  return str
}

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str === '' ? null : str
}

const requireInt = (value: unknown, fieldName: string): number => {
  const n = optionalInt(value)
  if (n === null) throw new Error(`Campo "${fieldName}" inválido o vacío`)
  return n
}

const optionalInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string') {
    const n = Number.parseInt(value.trim(), 10)
    return Number.isInteger(n) ? n : null
  }
  return null
}

const requirePositiveDecimal = (value: unknown, fieldName: string): string => {
  const dec = optionalDecimal(value)
  if (dec === null) throw new Error(`Campo "${fieldName}" no es numérico`)
  if (dec.startsWith('-')) throw new Error(`Campo "${fieldName}" debe ser positivo`)
  return dec
}

const optionalDecimal = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value.toString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.')
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
    return trimmed
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return optionalDecimal((value as { result: unknown }).result)
  }
  return null
}

const optionalDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string') {
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/.exec(value)
    if (ddmmyyyy) {
      const [, day, month, year, hour, min, sec] = ddmmyyyy
      const date = new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(min),
          Number(sec),
        ),
      )
      return Number.isNaN(date.getTime()) ? null : date
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const snippet = (rawValues: unknown): string => {
  const values = normalizeRowValues(rawValues)
  return values
    .slice(0, 6)
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(' | ')
    .slice(0, 200)
}

const collectRawValues = (
  values: unknown[],
  idx: ColumnIndex,
): Record<string, unknown> => ({
  quoteNumber: values[idx.quoteNumber] ?? null,
  createdAt: values[idx.createdAt] ?? null,
  status: values[idx.status] ?? null,
  createdBy: values[idx.createdBy] ?? null,
  accountNumber: values[idx.accountNumber] ?? null,
  amountUSDT: values[idx.amountUSDT] ?? null,
  amountBOB: values[idx.amountBOB] ?? null,
  exchangeRate: values[idx.exchangeRate] ?? null,
  commission: values[idx.commission] ?? null,
  transactionId: values[idx.transactionId] ?? null,
  serviceCode: values[idx.serviceCode] ?? null,
})
