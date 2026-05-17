import ExcelJS from 'exceljs'
import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { BalanceSheetService } from './balance-sheet.service'
import { BanexTransferService } from './banex-transfer.service'
import { ExcelReportService } from './excel-report.service'
import { UploadNotFoundError } from '../uploads/errors/upload.errors'
import type { PrismaService } from '../prisma/prisma.service'

const decimal = (value: string) => ({ toString: () => value })

const readWorkbook = async (buffer: Buffer): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook
}

describe('Report services', () => {
  it('genera el reporte maestro con hojas esperadas desde datos persistidos', async () => {
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({
          id: 'upload-1',
          originalName: 'reporte.xlsx',
          fileHash: 'hash-1',
          period: '2025-05',
          createdAt: new Date('2025-05-16T12:00:00.000Z'),
          rebates: [
            {
              userAccount: { accountNumber: '10001', username: 'victor' },
              tier: { name: 'Basico', level: 1 },
              period: '2025-05',
              totalSpentBOB: decimal('100.00'),
              totalSpentUSDT: decimal('7.50000000'),
              rebatePercent: decimal('1.00'),
              rebateBOB: decimal('1.00'),
              rebateUSDT: decimal('0.07500000'),
              avgExchangeRate: decimal('13.33333333'),
              paidOut: false,
              paidOutAt: null,
            },
          ],
          anomalies: [
            {
              type: 'AMOUNT_MISMATCH',
              transactionId: '=tx-risk',
              ledgerAmountBOB: decimal('10.00'),
              extractAmountBOB: decimal('9.00'),
              deltaBOB: decimal('1.00'),
              resolved: false,
              resolutionNote: null,
            },
          ],
          parseErrors: [],
          extractEntries: [
            {
              extractKind: 'PAYMENT',
              sourceRowNumber: 2,
              transactionId: '207681530',
              transactedAt: new Date('2025-05-02T09:02:15.000Z'),
              amountBOB: decimal('5.00'),
            },
            {
              extractKind: 'COLLECTION',
              sourceRowNumber: 3,
              transactionId: '307681530',
              transactedAt: new Date('2025-05-02T10:02:15.000Z'),
              amountBOB: decimal('7.50'),
            },
          ],
        })),
      },
    }

    const file = await new ExcelReportService(prisma as unknown as PrismaService).generate('upload-1')
    const workbook = await readWorkbook(file.buffer)

    expect(file.filename).toBe('BanexReintegra-Reporte-2025-05.xlsx')
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Reintegros',
      'Resumen por nivel',
      'Anomalías',
      'Errores de parseo',
      'Extracto de Pagos',
      'Extracto de Cobros',
      'Trazabilidad',
    ])
    expect(workbook.getWorksheet('Anomalías')?.getCell('B2').value).toBe("'=tx-risk")
    expect(workbook.getWorksheet('Resumen por nivel')).toBeDefined()
    expect(workbook.getWorksheet('Extracto de Pagos')?.getCell('E2').value).toBe(-5)
    expect(workbook.getWorksheet('Extracto de Cobros')?.getCell('E2').value).toBe(7.5)
  })

  it('genera archivo BanexTransfer solo con reintegros elegibles', async () => {
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({
          id: 'upload-1',
          period: '2025-05',
          originalName: 'reporte.xlsx',
          createdAt: new Date('2025-05-16T12:00:00.000Z'),
        })),
      },
      monthlyRebate: {
        findMany: vi.fn(async () => [
          {
            rebateUSDT: decimal('0.07500000'),
            userAccount: { accountNumber: '10001', username: 'victor' },
          },
          {
            rebateUSDT: decimal('0'),
            userAccount: { accountNumber: '10002', username: 'ana' },
          },
        ]),
      },
    }
    const service = new BanexTransferService(
      prisma as unknown as PrismaService,
      new ConfigService({ TREASURY_ACCOUNT_NUMBER: '99999', TREASURY_ACCOUNT_ALIAS: 'Tesoreria' }),
    )

    const file = await service.generate('upload-1')
    const workbook = await readWorkbook(file.buffer)
    const sheet = workbook.getWorksheet('Transfers')

    expect(file.filename).toBe('BanexTransfer-2025-05.xlsx')
    expect(sheet?.getCell('D2').value).toBe('99999')
    expect(sheet?.getCell('G2').value).toBe('10001')
    expect(sheet?.getCell('B3').value).toBe('TOTAL')
  })

  it('genera cuadre debe/haber y falla si el upload no existe', async () => {
    const prisma = {
      upload: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'upload-1',
            period: '2025-05',
            originalName: 'reporte.xlsx',
            createdAt: new Date('2025-05-16T12:00:00.000Z'),
          })
          .mockResolvedValueOnce(null),
      },
      ledgerTransaction: {
        findMany: vi.fn(async () => [
          {
            serviceCode: 'S-001',
            direction: 'DEBIT',
            amountBOB: decimal('100.00'),
            userAccount: { accountNumber: '10001', username: 'victor' },
          },
        ]),
      },
      monthlyRebate: {
        findMany: vi.fn(async () => [
          {
            rebateBOB: decimal('1.00'),
            userAccount: { accountNumber: '10001', username: 'victor' },
          },
        ]),
      },
    }
    const service = new BalanceSheetService(prisma as unknown as PrismaService)

    const file = await service.generate('upload-1')
    const workbook = await readWorkbook(file.buffer)
    const sheet = workbook.getWorksheet('Cuadre')

    expect(file.filename).toBe('Cuadre-DEBE-HABER-2025-05.xlsx')
    expect(sheet?.getCell('C2').value).toBe(1)
    expect(sheet?.getCell('D2').value).toBe(100)
    expect(sheet?.getCell('E2').value).toBe(-99)
    await expect(service.generate('missing')).rejects.toBeInstanceOf(UploadNotFoundError)
  })
})
