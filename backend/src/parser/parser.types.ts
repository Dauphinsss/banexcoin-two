/**
 * Contratos del módulo de parsing. Espejo exacto del contrato declarado
 * en agents.md (ParseAgent). Todos los montos son strings con precisión decimal.
 */

export interface QRTransactionRaw {
  rowNumber: number
  transactionId: string
  username: string
  accountNumber: number
  amountUSDT: string
  amountBOB: string
  exchangeRate: string
  commission: string
  status: string
  serviceCode: string
  quoteNumber: number | null
  transactedAt: Date | null
  raw: Record<string, unknown>
}

export interface ExtractRowRaw {
  rowNumber: number
  transactionId: string
  amountBOB: string
  transactedAt: Date | null
  raw: Record<string, unknown>
}

export interface ParseError {
  sheetName: string
  rowNumber: number
  message: string
  rawSnippet: string | null
}

export interface ParseMetadata {
  filename: string
  fileHash: string
  sheets: string[]
  rowCount: number
}

export interface ParseResult {
  period: string | null
  periodWarning: string | null
  qrRows: QRTransactionRaw[]
  extractRows: ExtractRowRaw[]
  parseErrors: ParseError[]
  metadata: ParseMetadata
}

/**
 * Nombres EXACTOS de las hojas en el Excel del enunciado.
 * El segundo tiene un espacio al final — no quitarlo.
 */
export const SHEET_PAGO_QR = 'Pago QR'
export const SHEET_EXTRACTO_PAGOS = 'EXTRACTO DE PAGOS '

/**
 * Cabeceras esperadas en `Pago QR` (row 1 del Excel).
 * Si alguna obligatoria falta, el parseo de la hoja aborta antes de leer filas.
 */
export const REQUIRED_PAGO_QR_HEADERS = [
  'Creado por',
  'Número de Cuenta',
  'Monto intercambio',
  'Monto Pagado',
  'Precio',
  'Transacción Id',
] as const
