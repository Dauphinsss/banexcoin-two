import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import ExcelJS from 'exceljs'
import { PrismaService } from '../prisma/prisma.service'
import { UploadNotFoundError } from '../uploads/errors/upload.errors'
import type { ReportFile } from './report.types'

/**
 * F6.2 · Genera el archivo de BanexTransfer listo para ejecutar pagos masivos.
 *
 * Replica el formato de la hoja `Transfers` del Excel del enunciado:
 *   createdAt | transferNumber | amount | senderAccount.accountNumber |
 *   senderAccount.alias | product.symbol | receiverAccount.accountNumber |
 *   receiverAccount.alias | Tipo de servicio | oms.name
 *
 * - Una fila por MonthlyRebate con `tierId != null` y `rebateUSDT > 0`
 * - Sender = cuenta tesorería (env vars TREASURY_ACCOUNT_NUMBER / TREASURY_ACCOUNT_ALIAS)
 * - Tipo de servicio = S-005 (BanexTransfer según hoja Servicios)
 * - product.symbol = USDT
 * - Idempotente: regenerar para el mismo upload produce mismo archivo
 *   (transferNumber se calcula desde 1 según orden por rebateUSDT desc)
 */
@Injectable()
export class BanexTransferService {
  private readonly logger = new Logger(BanexTransferService.name)
  private readonly treasuryAccount: string
  private readonly treasuryAlias: string
  private readonly omsName: string

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.treasuryAccount = config.get<string>('TREASURY_ACCOUNT_NUMBER') ?? '10000'
    this.treasuryAlias = config.get<string>('TREASURY_ACCOUNT_ALIAS') ?? 'BanexTesoreria'
    this.omsName = config.get<string>('OMS_NAME') ?? 'Banexcoin Bolivia'
  }

  async generate(uploadId: string): Promise<ReportFile> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true, period: true, originalName: true, createdAt: true },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    const rebates = await this.prisma.monthlyRebate.findMany({
      where: {
        uploadId,
        tierId: { not: null },
      },
      include: { userAccount: true },
      orderBy: [{ rebateUSDT: 'desc' }],
    })

    const eligible = rebates.filter((r) => toNumber(r.rebateUSDT) > 0)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'BanexReintegra'
    workbook.created = new Date()

    const ws = workbook.addWorksheet('Transfers')
    ws.columns = [
      { header: 'createdAt', key: 'createdAt', width: 22 },
      { header: 'transferNumber', key: 'transferNumber', width: 14 },
      { header: 'amount', key: 'amount', width: 14, style: { numFmt: '#,##0.00000000' } },
      { header: 'senderAccount.accountNumber', key: 'senderAccount', width: 24 },
      { header: 'senderAccount.alias', key: 'senderAlias', width: 20 },
      { header: 'product.symbol', key: 'symbol', width: 12 },
      { header: 'receiverAccount.accountNumber', key: 'receiverAccount', width: 26 },
      { header: 'receiverAccount.alias', key: 'receiverAlias', width: 28 },
      { header: 'Tipo de servicio', key: 'serviceCode', width: 14 },
      { header: 'oms.name', key: 'omsName', width: 22 },
    ]
    styleHeader(ws.getRow(1))

    const now = upload.createdAt.toISOString()

    eligible.forEach((rebate, index) => {
      ws.addRow({
        createdAt: now,
        transferNumber: index + 1,
        amount: toNumber(rebate.rebateUSDT),
        senderAccount: this.treasuryAccount,
        senderAlias: this.treasuryAlias,
        symbol: 'USDT',
        receiverAccount: rebate.userAccount.accountNumber,
        receiverAlias: rebate.userAccount.username ?? rebate.userAccount.accountNumber,
        serviceCode: 'S-005',
        omsName: this.omsName,
      })
    })

    ws.views = [{ state: 'frozen', ySplit: 1 }]
    if (eligible.length > 0) {
      ws.autoFilter = { from: 'A1', to: `J${eligible.length + 1}` }
    }

    const totalRow = ws.addRow({
      createdAt: '',
      transferNumber: 'TOTAL',
      amount: eligible.reduce((sum, r) => sum + toNumber(r.rebateUSDT), 0),
    })
    totalRow.font = { bold: true }

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const period = upload.period ?? 'sin-periodo'
    const filename = `BanexTransfer-${period}.xlsx`

    this.logger.log(
      `BanexTransfer generado · upload=${uploadId} · period=${period} · transferencias=${eligible.length}`,
    )

    return {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    }
  }
}

const styleHeader = (row: ExcelJS.Row): void => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0E9F6E' }, // verde "cash" — es archivo de pagos
  }
  row.alignment = { vertical: 'middle' }
  row.height = 22
}

const toNumber = (value: { toString: () => string } | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const parsed = Number.parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}
