import { describe, it, expect, beforeAll } from 'vitest'
import ExcelJS from 'exceljs'
import { ParserService } from './parser.service'
import {
  SHEET_EXTRACTO_COBROS,
  SHEET_EXTRACTO_PAGOS,
  SHEET_PAGO_QR,
} from './parser.types'

const buildExcel = async (opts: {
  pagoQRHeaders?: readonly string[]
  pagoQRRows?: readonly unknown[][]
  extractoRows?: readonly unknown[][]
  extractoCobrosRows?: readonly unknown[][]
  includePagoQR?: boolean
  includeExtracto?: boolean
  includeExtractoCobros?: boolean
}): Promise<Buffer> => {
  const wb = new ExcelJS.Workbook()

  if (opts.includePagoQR !== false) {
    const sheet = wb.addWorksheet(SHEET_PAGO_QR)
    const headers = opts.pagoQRHeaders ?? DEFAULT_PAGO_QR_HEADERS
    sheet.addRow([...headers])
    for (const row of opts.pagoQRRows ?? []) {
      sheet.addRow(row)
    }
  }

  if (opts.includeExtracto) {
    const sheet = wb.addWorksheet(SHEET_EXTRACTO_PAGOS)
    sheet.addRow([]) // row 1 vacía
    sheet.addRow([null, 'Fecha', 'Hora', 'Codigo de transacción ', 'Importe en bolivianos'])
    for (const row of opts.extractoRows ?? []) {
      sheet.addRow(row)
    }
  }

  if (opts.includeExtractoCobros) {
    const sheet = wb.addWorksheet(SHEET_EXTRACTO_COBROS)
    sheet.addRow([])
    sheet.addRow([null, 'Fecha', 'Hora', 'Codigo de transacción ', 'Importe en bolivianos'])
    for (const row of opts.extractoCobrosRows ?? []) {
      sheet.addRow(row)
    }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}

const DEFAULT_PAGO_QR_HEADERS = [
  'Número de cotización',
  'Fecha de creación',
  'Estado',
  'Side Cliente',
  'Creado por',
  'Número de Cuenta',
  'Monto intercambio',
  'Monto Pagado',
  'Moneda',
  'Precio',
  'Comisión',
  'Fecha de actualización',
  'Transacción Id',
  'Tipo de servicio',
  'OMS',
] as const

const validRow = (overrides?: Partial<Record<string, unknown>>): unknown[] => {
  const defaults: Record<string, unknown> = {
    quoteNumber: 8,
    createdAt: new Date(Date.UTC(2025, 3, 15, 9, 1, 55)),
    status: 'Completed',
    sideCliente: 'Sell',
    createdBy: 'VictorFernandez452024',
    accountNumber: 10001,
    amountUSDT: 0.378,
    amountBOB: 5,
    moneda: 'BOB',
    exchangeRate: 13.2065,
    commission: 0.03,
    updatedAt: new Date(Date.UTC(2025, 3, 15, 9, 2, 17)),
    transactionId: 207681530,
    serviceCode: 'S-001',
    oms: 'Banexcoin Bolivia',
  }
  const merged = { ...defaults, ...overrides }
  return [
    merged.quoteNumber,
    merged.createdAt,
    merged.status,
    merged.sideCliente,
    merged.createdBy,
    merged.accountNumber,
    merged.amountUSDT,
    merged.amountBOB,
    merged.moneda,
    merged.exchangeRate,
    merged.commission,
    merged.updatedAt,
    merged.transactionId,
    merged.serviceCode,
    merged.oms,
  ]
}

describe('ParserService.parseBuffer', () => {
  let service: ParserService

  beforeAll(() => {
    service = new ParserService()
  })

  it('parsea correctamente una fila válida con todos los campos', async () => {
    const buffer = await buildExcel({ pagoQRRows: [validRow()] })

    const result = await service.parseBuffer(buffer, {
      filename: 'test.xlsx',
      fileHash: 'hash1',
    })

    expect(result.qrRows).toHaveLength(1)
    const row = result.qrRows[0]!
    expect(row.transactionId).toBe('207681530')
    expect(row.username).toBe('VictorFernandez452024')
    expect(row.accountNumber).toBe(10001)
    expect(row.amountBOB).toBe('5')
    expect(row.amountUSDT).toBe('0.378')
    expect(row.exchangeRate).toBe('13.2065')
    expect(row.transactedAt).toBeInstanceOf(Date)
    expect(result.parseErrors).toHaveLength(0)
  })

  it('detecta el período mayoritario desde las fechas', async () => {
    const buffer = await buildExcel({
      pagoQRRows: [
        validRow({ createdAt: new Date(Date.UTC(2025, 3, 1)) }),
        validRow({ createdAt: new Date(Date.UTC(2025, 3, 15)) }),
        validRow({ createdAt: new Date(Date.UTC(2025, 3, 30)) }),
      ],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.period).toBe('2025-04')
    expect(result.periodWarning).toBeNull()
  })

  it('aborta con error si faltan headers obligatorios', async () => {
    const buffer = await buildExcel({
      pagoQRHeaders: ['Foo', 'Bar', 'Baz'],
      pagoQRRows: [],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.qrRows).toHaveLength(0)
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]?.message).toMatch(/Faltan columnas obligatorias/)
  })

  it('acumula filas inválidas en parseErrors sin abortar el resto', async () => {
    const buffer = await buildExcel({
      pagoQRRows: [
        validRow(),
        validRow({ transactionId: null }),       // inválida
        validRow({ amountBOB: 'no-es-numero' }), // inválida
        validRow(),
      ],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.qrRows).toHaveLength(2)
    expect(result.parseErrors).toHaveLength(2)
  })

  it('rechaza montos negativos', async () => {
    const buffer = await buildExcel({
      pagoQRRows: [validRow({ amountBOB: -5 })],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.qrRows).toHaveLength(0)
    expect(result.parseErrors[0]?.message).toMatch(/positivo/)
  })

  it('parsea la hoja EXTRACTO DE PAGOS y normaliza importes negativos a positivos', async () => {
    const buffer = await buildExcel({
      pagoQRRows: [validRow()],
      includeExtracto: true,
      extractoRows: [
        [
          2,
          new Date(Date.UTC(2025, 3, 15)),
          new Date(Date.UTC(2025, 3, 15, 9, 2, 15)),
          207681530,
          -5, // débito → debe normalizarse a 5
        ],
      ],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.extractRows).toHaveLength(1)
    const row = result.extractRows[0]!
    expect(row.transactionId).toBe('207681530')
    expect(row.amountBOB).toBe('5')
  })

  it('parsea la hoja EXTRACTO DE COBROS sin mezclarla con conciliación de pagos', async () => {
    const buffer = await buildExcel({
      pagoQRRows: [validRow()],
      includeExtracto: true,
      extractoRows: [
        [
          2,
          new Date(Date.UTC(2025, 3, 15)),
          new Date(Date.UTC(2025, 3, 15, 9, 2, 15)),
          207681530,
          -5,
        ],
      ],
      includeExtractoCobros: true,
      extractoCobrosRows: [
        [
          2,
          new Date(Date.UTC(2025, 3, 16)),
          new Date(Date.UTC(2025, 3, 16, 10, 1, 0)),
          307681530,
          12.5,
        ],
      ],
    })

    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.extractRows).toHaveLength(1)
    expect(result.collectionExtractRows).toHaveLength(1)
    expect(result.collectionExtractRows[0]?.transactionId).toBe('307681530')
    expect(result.collectionExtractRows[0]?.amountBOB).toBe('12.5')
  })

  it('falta la hoja Pago QR → un solo error y rows vacío', async () => {
    const buffer = await buildExcel({ includePagoQR: false })
    const result = await service.parseBuffer(buffer, {
      filename: 't.xlsx',
      fileHash: 'h',
    })

    expect(result.qrRows).toHaveLength(0)
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]?.message).toMatch(/Pago QR.*no encontrada/)
  })

  it('rendimiento: procesa 1000 filas válidas en <2s', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      validRow({ transactionId: 200000000 + i }),
    )
    const buffer = await buildExcel({ pagoQRRows: rows })

    const start = Date.now()
    const result = await service.parseBuffer(buffer, {
      filename: 'bulk.xlsx',
      fileHash: 'hbulk',
    })
    const elapsed = Date.now() - start

    expect(result.qrRows).toHaveLength(1000)
    expect(result.parseErrors).toHaveLength(0)
    expect(elapsed).toBeLessThan(2000)
  })
})
