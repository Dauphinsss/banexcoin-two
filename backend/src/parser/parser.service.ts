import { Injectable, Logger } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { detectPeriod } from '@banex/utils'
import {
  type ParseResult,
  SHEET_EXTRACTO_PAGOS,
  SHEET_PAGO_QR,
} from './parser.types'
import { parsePagoQRSheet } from './pago-qr.parser'
import { parseExtractoPagosSheet } from './extracto-pagos.parser'

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name)

  /**
   * Parsea un Excel desde buffer en memoria.
   *
   * No persiste nada. Devuelve un `ParseResult` listo para ser consumido
   * por el TierAgent, ReconcileAgent y PersistenceAgent.
   */
  async parseBuffer(
    buffer: Buffer,
    metadata: { filename: string; fileHash: string },
  ): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheets = workbook.worksheets.map((ws) => ws.name)

    const pagoQRSheet = findSheet(workbook, SHEET_PAGO_QR)
    if (!pagoQRSheet) {
      return this.emptyResult(metadata, sheets, [
        {
          sheetName: SHEET_PAGO_QR,
          rowNumber: 0,
          message: `Hoja "${SHEET_PAGO_QR}" no encontrada en el archivo.`,
          rawSnippet: null,
        },
      ])
    }

    const pagoQR = parsePagoQRSheet(pagoQRSheet)

    const extractoSheet = findSheet(workbook, SHEET_EXTRACTO_PAGOS)
    const extracto = extractoSheet
      ? parseExtractoPagosSheet(extractoSheet)
      : { rows: [], errors: [] }

    const detection = detectPeriod(pagoQR.rows.map((r) => r.transactedAt))

    const result: ParseResult = {
      period: detection.period,
      periodWarning: detection.warning?.message ?? null,
      qrRows: pagoQR.rows,
      extractRows: extracto.rows,
      parseErrors: [...pagoQR.errors, ...extracto.errors],
      metadata: {
        filename: metadata.filename,
        fileHash: metadata.fileHash,
        sheets,
        rowCount: pagoQR.rows.length,
      },
    }

    this.logger.log(
      `Parse OK · file=${metadata.fileHash.slice(0, 8)} · qrRows=${result.qrRows.length} · extractRows=${result.extractRows.length} · errors=${result.parseErrors.length}`,
    )

    return result
  }

  private emptyResult(
    meta: { filename: string; fileHash: string },
    sheets: string[],
    errors: ParseResult['parseErrors'],
  ): ParseResult {
    return {
      period: null,
      periodWarning: null,
      qrRows: [],
      extractRows: [],
      parseErrors: errors,
      metadata: {
        filename: meta.filename,
        fileHash: meta.fileHash,
        sheets,
        rowCount: 0,
      },
    }
  }
}

const findSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
): ExcelJS.Worksheet | undefined => {
  // exceljs es case-sensitive y respeta espacios; usamos comparación tolerante
  return workbook.worksheets.find(
    (ws) => ws.name === name || ws.name.trim() === name.trim(),
  )
}
