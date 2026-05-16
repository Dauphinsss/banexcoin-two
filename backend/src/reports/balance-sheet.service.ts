import { Inject, Injectable, Logger } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { PrismaService } from '../prisma/prisma.service'
import { UploadNotFoundError } from '../uploads/errors/upload.errors'
import type { ReportFile } from './report.types'

/**
 * F6.3 · Genera el cuadre DEBE/HABER por usuario, replicando la hoja
 * `Saldos` del Excel original.
 *
 * Reglas según hoja `Servicios` del Excel del enunciado:
 *   S-001 PAGO QR        → HABER (disminuye saldo del cliente)
 *   S-002 COBRO QR       → DEBE  (aumenta saldo del cliente)
 *   S-003 RETIROS        → HABER
 *   S-004 DEPOSITOS      → DEBE
 *   S-005 BANEXTRANSFER  → DEBE para receiver, HABER para sender
 *
 * Si el parser solo procesó Pagos QR, el cuadre muestra únicamente HABER de S-001
 * más DEBE de reintegros pagados. El reporte deja constancia explícita de qué
 * servicios fueron considerados.
 */
@Injectable()
export class BalanceSheetService {
  private readonly logger = new Logger(BalanceSheetService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async generate(uploadId: string): Promise<ReportFile> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true, period: true, originalName: true, createdAt: true },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: { uploadId },
      include: { userAccount: true },
    })

    const rebates = await this.prisma.monthlyRebate.findMany({
      where: { uploadId, paidOut: true },
      include: { userAccount: true },
    })

    type AccountAgg = {
      accountNumber: string
      username: string | null
      debeBOB: number
      haberBOB: number
      services: Set<string>
    }

    const byAccount = new Map<string, AccountAgg>()
    const servicesFound = new Set<string>()

    const ensure = (accountNumber: string, username: string | null): AccountAgg => {
      let agg = byAccount.get(accountNumber)
      if (!agg) {
        agg = {
          accountNumber,
          username,
          debeBOB: 0,
          haberBOB: 0,
          services: new Set(),
        }
        byAccount.set(accountNumber, agg)
      }
      return agg
    }

    for (const tx of transactions) {
      if (!tx.userAccount) continue
      const acc = ensure(tx.userAccount.accountNumber, tx.userAccount.username)
      acc.services.add(tx.serviceCode)
      servicesFound.add(tx.serviceCode)

      const amount = toNumber(tx.amountBOB)
      if (amount === 0) continue

      const movement = classify(tx.serviceCode, tx.direction)
      if (movement === 'DEBE') acc.debeBOB += amount
      else if (movement === 'HABER') acc.haberBOB += amount
    }

    for (const rebate of rebates) {
      const acc = ensure(rebate.userAccount.accountNumber, rebate.userAccount.username)
      acc.debeBOB += toNumber(rebate.rebateBOB)
      acc.services.add('REINTEGRO')
    }

    const rows = [...byAccount.values()]
      .map((acc) => ({
        ...acc,
        saldo: acc.debeBOB - acc.haberBOB,
      }))
      .sort((a, b) => (a.username ?? a.accountNumber).localeCompare(b.username ?? b.accountNumber, 'es-BO'))

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'BanexReintegra'
    workbook.created = new Date()

    this.addCuadreSheet(workbook, rows)
    this.addServiciosSheet(workbook, servicesFound)
    this.addLeyendaSheet(workbook)

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const period = upload.period ?? 'sin-periodo'
    const filename = `Cuadre-DEBE-HABER-${period}.xlsx`

    this.logger.log(
      `Cuadre generado · upload=${uploadId} · period=${period} · cuentas=${rows.length} · servicios=${[...servicesFound].join(',')}`,
    )

    return {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    }
  }

  private addCuadreSheet(
    wb: ExcelJS.Workbook,
    rows: Array<{
      accountNumber: string
      username: string | null
      debeBOB: number
      haberBOB: number
      saldo: number
      services: Set<string>
    }>,
  ): void {
    const ws = wb.addWorksheet('Cuadre')
    ws.columns = [
      { header: 'Cuenta', key: 'account', width: 14 },
      { header: 'Usuario', key: 'username', width: 30 },
      { header: 'DEBE (BOB)', key: 'debe', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'HABER (BOB)', key: 'haber', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Saldo (BOB)', key: 'saldo', width: 16, style: { numFmt: '#,##0.00;[Red]-#,##0.00' } },
      { header: 'Servicios involucrados', key: 'services', width: 28 },
    ]
    styleHeader(ws.getRow(1))

    let totalDebe = 0
    let totalHaber = 0

    for (const row of rows) {
      ws.addRow({
        account: row.accountNumber,
        username: row.username ?? row.accountNumber,
        debe: row.debeBOB,
        haber: row.haberBOB,
        saldo: row.saldo,
        services: [...row.services].sort().join(', '),
      })
      totalDebe += row.debeBOB
      totalHaber += row.haberBOB
    }

    if (rows.length > 0) {
      const totalRow = ws.addRow({
        account: '',
        username: 'TOTAL',
        debe: totalDebe,
        haber: totalHaber,
        saldo: totalDebe - totalHaber,
        services: '',
      })
      totalRow.font = { bold: true }
      totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FF1A56DB' } } }
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
    if (rows.length > 0) {
      ws.autoFilter = { from: 'A1', to: `F${rows.length + 1}` }
    }
  }

  private addServiciosSheet(wb: ExcelJS.Workbook, services: Set<string>): void {
    const ws = wb.addWorksheet('Servicios procesados')
    ws.columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'name', width: 22 },
      { header: 'Movimiento', key: 'kind', width: 14 },
      { header: 'Procesado en este upload', key: 'found', width: 26 },
    ]
    styleHeader(ws.getRow(1))

    const all: Array<[string, string, string]> = [
      ['S-001', 'PAGO QR', 'HABER'],
      ['S-002', 'COBRO QR', 'DEBE'],
      ['S-003', 'RETIROS', 'HABER'],
      ['S-004', 'DEPOSITOS', 'DEBE'],
      ['S-005', 'BANEXTRANSFER', 'Depende del rol'],
      ['REINTEGRO', 'Reintegro pagado', 'DEBE'],
    ]

    for (const [code, name, kind] of all) {
      ws.addRow({
        code,
        name,
        kind,
        found: services.has(code) ? '✓ Sí' : '— No',
      })
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  private addLeyendaSheet(wb: ExcelJS.Workbook): void {
    const ws = wb.addWorksheet('Leyenda')
    ws.columns = [
      { header: 'Concepto', key: 'k', width: 28 },
      { header: 'Detalle', key: 'v', width: 80 },
    ]
    styleHeader(ws.getRow(1))
    ws.addRow({ k: 'DEBE', v: 'Importes que incrementan el saldo del usuario (cobros, depósitos, reintegros recibidos).' })
    ws.addRow({ k: 'HABER', v: 'Importes que disminuyen el saldo del usuario (pagos QR, retiros, transferencias emitidas).' })
    ws.addRow({ k: 'Saldo', v: 'Saldo del período = DEBE − HABER. Negativo indica deuda neta con Banexcoin.' })
    ws.addRow({ k: 'Cobertura', v: 'Si una hoja del Excel original no fue parseada, su servicio no aparece en este cuadre. Ver pestaña "Servicios procesados".' })
    ws.addRow({ k: 'Reintegros', v: 'Los reintegros del mes solo entran al DEBE cuando están marcados como pagados.' })
  }
}

type Movement = 'DEBE' | 'HABER' | 'NEUTRAL'

const classify = (serviceCode: string, direction: string | null): Movement => {
  switch (serviceCode) {
    case 'S-002':
    case 'S-004':
      return 'DEBE'
    case 'S-001':
    case 'S-003':
      return 'HABER'
    case 'S-005':
      // BanexTransfer: la dirección viene del propio ledger (DEBIT|CREDIT desde la
      // perspectiva del cliente). DEBIT en el ledger = HABER en partida doble.
      if (direction === 'CREDIT') return 'DEBE'
      if (direction === 'DEBIT') return 'HABER'
      return 'NEUTRAL'
    default:
      return 'NEUTRAL'
  }
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
