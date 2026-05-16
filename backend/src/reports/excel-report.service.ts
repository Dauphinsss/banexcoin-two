import { Inject, Injectable, Logger } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { PrismaService } from '../prisma/prisma.service'
import { UploadNotFoundError } from '../uploads/errors/upload.errors'
import type { ReportFile } from './report.types'

/**
 * F6.1 · Genera el Excel maestro de reintegros con 4 hojas:
 *   1. Reintegros        — una fila por MonthlyRebate
 *   2. Resumen por nivel — agregados (count, totales, %)
 *   3. Anomalías         — listado con tipo, transactionId, delta
 *   4. Errores de parseo — filas que no pudieron leerse
 *
 * Idempotente: siempre lee desde DB, nunca persiste.
 */
@Injectable()
export class ExcelReportService {
  private readonly logger = new Logger(ExcelReportService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async generate(uploadId: string): Promise<ReportFile> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        rebates: {
          include: { userAccount: true, tier: true },
          orderBy: { rebateUSDT: 'desc' },
        },
        anomalies: { orderBy: { type: 'asc' } },
        parseErrors: { orderBy: { rowNumber: 'asc' } },
      },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'BanexReintegra'
    workbook.created = new Date()

    this.addRebatesSheet(workbook, upload.rebates)
    this.addSummarySheet(workbook, upload.rebates)
    this.addAnomaliesSheet(workbook, upload.anomalies)
    this.addParseErrorsSheet(workbook, upload.parseErrors)
    this.addMetadataFooter(workbook, upload)

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)

    const period = upload.period ?? 'sin-periodo'
    const filename = `BanexReintegra-Reporte-${period}.xlsx`

    this.logger.log(
      `Excel reporte generado · upload=${uploadId} · period=${period} · rebates=${upload.rebates.length} · bytes=${buffer.length}`,
    )

    return {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    }
  }

  private addRebatesSheet(
    wb: ExcelJS.Workbook,
    rebates: Array<{
      userAccount: { accountNumber: string; username: string | null }
      tier: { name: string } | null
      period: string
      totalSpentBOB: { toString: () => string } | null
      totalSpentUSDT: { toString: () => string } | null
      rebatePercent: { toString: () => string } | null
      rebateBOB: { toString: () => string } | null
      rebateUSDT: { toString: () => string } | null
      avgExchangeRate: { toString: () => string } | null
      paidOut: boolean
      paidOutAt: Date | null
    }>,
  ): void {
    const ws = wb.addWorksheet('Reintegros')
    ws.columns = [
      { header: 'Cuenta', key: 'account', width: 12 },
      { header: 'Usuario', key: 'username', width: 28 },
      { header: 'Período', key: 'period', width: 10 },
      { header: 'Total BOB', key: 'totalBOB', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Total USDT', key: 'totalUSDT', width: 14, style: { numFmt: '#,##0.00000000' } },
      { header: 'Nivel', key: 'tier', width: 14 },
      { header: '% Cashback', key: 'percent', width: 12, style: { numFmt: '0.00"%"' } },
      { header: 'Reintegro BOB', key: 'rebateBOB', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Reintegro USDT', key: 'rebateUSDT', width: 16, style: { numFmt: '#,##0.00000000' } },
      { header: 'T/C promedio', key: 'avgRate', width: 14, style: { numFmt: '0.00000000' } },
      { header: 'Pagado', key: 'paid', width: 10 },
      { header: 'Pagado el', key: 'paidAt', width: 20 },
    ]
    styleHeader(ws.getRow(1))

    for (const rebate of rebates) {
      ws.addRow({
        account: rebate.userAccount.accountNumber,
        username: rebate.userAccount.username ?? rebate.userAccount.accountNumber,
        period: rebate.period,
        totalBOB: toNumber(rebate.totalSpentBOB),
        totalUSDT: toNumber(rebate.totalSpentUSDT),
        tier: rebate.tier?.name ?? 'Sin nivel',
        percent: toNumber(rebate.rebatePercent),
        rebateBOB: toNumber(rebate.rebateBOB),
        rebateUSDT: toNumber(rebate.rebateUSDT),
        avgRate: toNumber(rebate.avgExchangeRate),
        paid: rebate.paidOut ? 'Sí' : 'No',
        paidAt: rebate.paidOutAt ? rebate.paidOutAt.toISOString().slice(0, 16).replace('T', ' ') : '',
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: 'A1', to: `L${rebates.length + 1}` }
  }

  private addSummarySheet(
    wb: ExcelJS.Workbook,
    rebates: Array<{
      tier: { name: string; level: number } | null
      rebateBOB: { toString: () => string } | null
      rebateUSDT: { toString: () => string } | null
      totalSpentBOB: { toString: () => string } | null
    }>,
  ): void {
    const ws = wb.addWorksheet('Resumen por nivel')
    ws.columns = [
      { header: 'Nivel', key: 'tier', width: 16 },
      { header: 'Usuarios', key: 'users', width: 10 },
      { header: 'Total gastado BOB', key: 'spent', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Reintegro BOB', key: 'rebateBOB', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Reintegro USDT', key: 'rebateUSDT', width: 18, style: { numFmt: '#,##0.00000000' } },
      { header: '% del total USDT', key: 'share', width: 16, style: { numFmt: '0.00"%"' } },
    ]
    styleHeader(ws.getRow(1))

    type Bucket = { users: number; spent: number; rebateBOB: number; rebateUSDT: number; level: number }
    const buckets = new Map<string, Bucket>()
    let totalUSDT = 0

    for (const r of rebates) {
      const name = r.tier?.name ?? 'Sin nivel'
      const current = buckets.get(name) ?? {
        users: 0,
        spent: 0,
        rebateBOB: 0,
        rebateUSDT: 0,
        level: r.tier?.level ?? 999,
      }
      current.users += 1
      current.spent += toNumber(r.totalSpentBOB)
      current.rebateBOB += toNumber(r.rebateBOB)
      current.rebateUSDT += toNumber(r.rebateUSDT)
      totalUSDT += toNumber(r.rebateUSDT)
      buckets.set(name, current)
    }

    const ordered = [...buckets.entries()].sort((a, b) => a[1].level - b[1].level)

    for (const [tier, bucket] of ordered) {
      ws.addRow({
        tier,
        users: bucket.users,
        spent: bucket.spent,
        rebateBOB: bucket.rebateBOB,
        rebateUSDT: bucket.rebateUSDT,
        share: totalUSDT > 0 ? (bucket.rebateUSDT / totalUSDT) * 100 : 0,
      })
    }

    if (ordered.length > 0) {
      const totalRow = ws.addRow({
        tier: 'TOTAL',
        users: ordered.reduce((s, [, b]) => s + b.users, 0),
        spent: ordered.reduce((s, [, b]) => s + b.spent, 0),
        rebateBOB: ordered.reduce((s, [, b]) => s + b.rebateBOB, 0),
        rebateUSDT: totalUSDT,
        share: 100,
      })
      totalRow.font = { bold: true }
      totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FF1A56DB' } } }
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  private addAnomaliesSheet(
    wb: ExcelJS.Workbook,
    anomalies: Array<{
      type: string
      transactionId: string
      ledgerAmountBOB: { toString: () => string } | null
      extractAmountBOB: { toString: () => string } | null
      deltaBOB: { toString: () => string } | null
      resolved: boolean
      resolutionNote: string | null
    }>,
  ): void {
    const ws = wb.addWorksheet('Anomalías')
    ws.columns = [
      { header: 'Tipo', key: 'type', width: 18 },
      { header: 'Transacción Id', key: 'tx', width: 22 },
      { header: 'QR BOB', key: 'qr', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Extracto BOB', key: 'ex', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Delta BOB', key: 'delta', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Resuelta', key: 'resolved', width: 10 },
      { header: 'Nota', key: 'note', width: 40 },
    ]
    styleHeader(ws.getRow(1))

    for (const a of anomalies) {
      ws.addRow({
        type: ANOMALY_LABELS[a.type] ?? a.type,
        tx: csvSafe(a.transactionId),
        qr: a.ledgerAmountBOB === null ? '' : toNumber(a.ledgerAmountBOB),
        ex: a.extractAmountBOB === null ? '' : toNumber(a.extractAmountBOB),
        delta: a.deltaBOB === null ? '' : toNumber(a.deltaBOB),
        resolved: a.resolved ? 'Sí' : 'No',
        note: csvSafe(a.resolutionNote ?? ''),
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
    if (anomalies.length > 0) {
      ws.autoFilter = { from: 'A1', to: `G${anomalies.length + 1}` }
    }
  }

  private addParseErrorsSheet(
    wb: ExcelJS.Workbook,
    errors: Array<{
      sheetName: string
      rowNumber: number
      columnName: string | null
      message: string
      rawRow: string | null
    }>,
  ): void {
    const ws = wb.addWorksheet('Errores de parseo')
    ws.columns = [
      { header: 'Hoja', key: 'sheet', width: 18 },
      { header: 'Fila', key: 'row', width: 8 },
      { header: 'Columna', key: 'col', width: 18 },
      { header: 'Mensaje', key: 'msg', width: 60 },
      { header: 'Snippet', key: 'snip', width: 60 },
    ]
    styleHeader(ws.getRow(1))

    for (const e of errors) {
      ws.addRow({
        sheet: e.sheetName,
        row: e.rowNumber,
        col: e.columnName ?? '',
        msg: csvSafe(e.message),
        snip: csvSafe(e.rawRow ?? ''),
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  private addMetadataFooter(
    wb: ExcelJS.Workbook,
    upload: {
      id: string
      originalName: string
      fileHash: string
      period: string | null
      createdAt: Date
    },
  ): void {
    const ws = wb.addWorksheet('Trazabilidad')
    ws.columns = [
      { header: 'Campo', key: 'k', width: 24 },
      { header: 'Valor', key: 'v', width: 60 },
    ]
    styleHeader(ws.getRow(1))
    ws.addRow({ k: 'Upload ID', v: upload.id })
    ws.addRow({ k: 'Archivo original', v: upload.originalName })
    ws.addRow({ k: 'Hash SHA-256', v: upload.fileHash })
    ws.addRow({ k: 'Período', v: upload.period ?? '—' })
    ws.addRow({ k: 'Procesado el', v: upload.createdAt.toISOString() })
    ws.addRow({ k: 'Reporte generado', v: new Date().toISOString() })
  }
}

const ANOMALY_LABELS: Record<string, string> = {
  NO_EXTRACT: 'Sin extracto',
  NO_QR: 'Sin QR',
  AMOUNT_MISMATCH: 'Monto distinto',
  INVALID_RATE: 'T/C inválido',
}

const styleHeader = (row: ExcelJS.Row): void => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A56DB' },
  }
  row.alignment = { vertical: 'middle' }
  row.height = 22
}

const toNumber = (value: { toString: () => string } | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const parsed = Number.parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * CONVENTIONS §7.5 — prevención de CSV/Formula injection en celdas Excel.
 * Prefija con apóstrofe cualquier celda que empiece con =, +, -, @.
 */
const csvSafe = (value: string): string => {
  if (!value) return ''
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
