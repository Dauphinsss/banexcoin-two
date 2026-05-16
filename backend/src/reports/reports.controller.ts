import { Controller, Get, Inject, Param, Res, UseFilters } from '@nestjs/common'
import type { Response } from 'express'
import { ExcelReportService } from './excel-report.service'
import { BanexTransferService } from './banex-transfer.service'
import { BalanceSheetService } from './balance-sheet.service'
import { UploadExceptionFilter } from '../uploads/filters/upload-exception.filter'
import type { ReportFile } from './report.types'

/**
 * F6.4 · Endpoints de descarga.
 * Las rutas se anidan bajo /api/uploads/:id para facilitar el linkado desde
 * el dashboard del frontend.
 */
@Controller('uploads/:id')
@UseFilters(UploadExceptionFilter)
export class ReportsController {
  constructor(
    @Inject(ExcelReportService) private readonly excel: ExcelReportService,
    @Inject(BanexTransferService) private readonly transfer: BanexTransferService,
    @Inject(BalanceSheetService) private readonly balance: BalanceSheetService,
  ) {}

  @Get('report')
  async report(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.excel.generate(id)
    this.send(res, file)
  }

  @Get('banex-transfer')
  async banexTransfer(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.transfer.generate(id)
    this.send(res, file)
  }

  @Get('balance-sheet')
  async balanceSheet(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.balance.generate(id)
    this.send(res, file)
  }

  private send(res: Response, file: ReportFile): void {
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeFilename(file.filename)}"`,
    )
    res.setHeader('Content-Length', file.buffer.length.toString())
    res.end(file.buffer)
  }
}

/**
 * Escape mínimo para Content-Disposition. RFC 6266 permite usar el filename*
 * encoding pero la mayoría de clientes acepta una versión ASCII con quotes.
 */
const encodeFilename = (name: string): string =>
  name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
