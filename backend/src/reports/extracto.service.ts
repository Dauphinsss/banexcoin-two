import { Inject, Injectable, Logger } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { PrismaService } from '../prisma/prisma.service'
import { UploadNotFoundError } from '../uploads/errors/upload.errors'
import type { ReportFile } from './report.types'
import {
  applyWorkbookMeta,
  BRAND,
  COL_WIDTH,
  finishTable,
  styleTableHeader,
  styleTotalRow,
} from './excel-style'

/**
 * F6.5 · Extracto bancario (Pagos / Cobros).
 *
 * Replica exactamente las hojas "EXTRACTO DE PAGOS" y "EXTRACTO DE COBROS"
 * del Excel del enunciado: una tabla simple con
 *
 *   # · Fecha · Hora · Codigo de transacción · Importe en bolivianos
 *
 * El importe es negativo en pagos (salida) y positivo en cobros (entrada),
 * replicando el signo del extracto original.
 *
 * Los datos salen de `BankExtractEntry` filtrando por `extractKind`. Si el
 * pipeline aún no parsea cierto tipo (p. ej. cobros), el reporte se genera
 * con su estructura pero sin filas — nunca falla.
 *
 * Idempotente: siempre lee de DB, nunca persiste.
 */
export type ExtractoKind = 'PAYMENT' | 'COLLECTION'

const KIND_META: Record<
  ExtractoKind,
  { sheet: string; fileTag: string; sign: 1 | -1; header: string }
> = {
  PAYMENT: {
    sheet: 'EXTRACTO DE PAGOS',
    fileTag: 'Extracto-Pagos',
    sign: -1,
    header: BRAND.orangeDeep,
  },
  COLLECTION: {
    sheet: 'EXTRACTO DE COBROS',
    fileTag: 'Extracto-Cobros',
    sign: 1,
    header: 'FF0E9F6E',
  },
}

@Injectable()
export class ExtractoService {
  private readonly logger = new Logger(ExtractoService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async generate(uploadId: string, kind: ExtractoKind): Promise<ReportFile> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true, period: true },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    const entries = await this.prisma.bankExtractEntry.findMany({
      where: { uploadId, extractKind: kind },
      orderBy: [{ transactedAt: 'asc' }, { sourceRowNumber: 'asc' }],
      select: {
        sourceRowNumber: true,
        transactionId: true,
        transactedAt: true,
        amountBOB: true,
      },
    })

    const meta = KIND_META[kind]
    const workbook = new ExcelJS.Workbook()
    applyWorkbookMeta(workbook)

    buildExtractoSheet(workbook, meta.sheet, kind, entries)

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const period = upload.period ?? 'sin-periodo'
    const filename = `${meta.fileTag}-${period}.xlsx`

    this.logger.log(
      `${meta.sheet} generado · upload=${uploadId} · period=${period} · filas=${entries.length}`,
    )

    return {
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    }
  }
}

/** Fila mínima de `BankExtractEntry` necesaria para construir la hoja. */
export interface ExtractoEntry {
  sourceRowNumber: number | null
  transactionId: string
  transactedAt: Date | null
  amountBOB: { toString: () => string } | null
}

/**
 * Construye una hoja de extracto (Pagos/Cobros) en el workbook dado.
 * Reutilizable: el endpoint individual y el reporte maestro la comparten,
 * garantizando que el formato sea idéntico en ambos.
 */
export const buildExtractoSheet = (
  wb: ExcelJS.Workbook,
  sheetName: string,
  kind: ExtractoKind,
  entries: ExtractoEntry[],
): void => {
  const meta = KIND_META[kind]
  const ws = wb.addWorksheet(sheetName)
  ws.columns = [
    { header: '#', key: 'idx', width: COL_WIDTH.int },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'Codigo de transacción', key: 'code', width: 24 },
    {
      header: 'Importe en bolivianos',
      key: 'amount',
      width: COL_WIDTH.bob,
      style: { numFmt: '#,##0.00;[Red]-#,##0.00' },
    },
  ]
  styleTableHeader(ws.getRow(1), { fill: meta.header })

  entries.forEach((e, i) => {
    const at = e.transactedAt
    ws.addRow({
      idx: e.sourceRowNumber ?? i + 1,
      fecha: at ? formatDate(at) : '',
      hora: at ? formatTime(at) : '',
      code: e.transactionId,
      amount: meta.sign * Math.abs(toNumber(e.amountBOB)),
    })
  })

  finishTable(ws, ['idx', 'amount'], entries.length + 1, { amount: 'signed' })

  if (entries.length > 0) {
    const totalRow = ws.addRow({
      idx: '',
      fecha: '',
      hora: '',
      code: 'TOTAL',
      amount: entries.reduce(
        (s, e) => s + meta.sign * Math.abs(toNumber(e.amountBOB)),
        0,
      ),
    })
    styleTotalRow(totalRow)
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  if (entries.length > 0) {
    ws.autoFilter = { from: 'A1', to: `E${entries.length + 1}` }
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')

const formatDate = (d: Date): string =>
  `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`

const formatTime = (d: Date): string =>
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`

const toNumber = (
  value: { toString: () => string } | null | undefined,
): number => {
  if (value === null || value === undefined) return 0
  const parsed = Number.parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}
