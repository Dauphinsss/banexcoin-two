import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { UploadsService } from './uploads.service'
import { DuplicateUploadError, InvalidFileError, UploadNotFoundError } from './errors/upload.errors'
import type { PrismaService } from '../prisma/prisma.service'
import type { FileStorageService } from './storage/file-storage.service'
import type { ParserService } from '../parser/parser.service'
import type { TierAgent } from '../jobs/agents/tier.agent'
import type { ReconcileAgent } from '../jobs/agents/reconcile.agent'
import type { TiersService } from '../tiers/tiers.service'

const makeFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'reporte.xlsx',
  encoding: '7bit',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: 10,
  buffer: Buffer.from('excel'),
  stream: undefined as unknown as Express.Multer.File['stream'],
  destination: '',
  filename: '',
  path: '',
  ...overrides,
})

const makeService = (
  prisma: unknown,
  config = new ConfigService({ MAX_UPLOAD_SIZE_MB: '1' }),
): UploadsService => new UploadsService(
  prisma as PrismaService,
  { hash: vi.fn(async () => 'hash-1'), save: vi.fn(async () => 'stored.xlsx') } as unknown as FileStorageService,
  { parseBuffer: vi.fn() } as unknown as ParserService,
  { run: vi.fn() } as unknown as TierAgent,
  { run: vi.fn() } as unknown as ReconcileAgent,
  { listActive: vi.fn() } as unknown as TiersService,
  config,
)

describe('UploadsService', () => {
  it('valida archivo antes de persistir o parsear', async () => {
    const service = makeService({})

    await expect(service.create(undefined as unknown as Express.Multer.File, '2025-05'))
      .rejects.toMatchObject({ name: 'InvalidFileError', reason: 'NO_FILE' })
    await expect(service.create(makeFile({ size: 0, buffer: Buffer.alloc(0) }), '2025-05'))
      .rejects.toMatchObject({ name: 'InvalidFileError', reason: 'EMPTY_FILE' })
    await expect(service.create(makeFile({ originalname: 'reporte.csv' }), '2025-05'))
      .rejects.toMatchObject({ name: 'InvalidFileError', reason: 'INVALID_EXTENSION' })
    await expect(service.create(makeFile({ mimetype: 'text/plain' }), '2025-05'))
      .rejects.toMatchObject({ name: 'InvalidFileError', reason: 'INVALID_MIME' })
    await expect(service.create(makeFile({ size: 2 * 1024 * 1024 }), '2025-05'))
      .rejects.toMatchObject({ name: 'InvalidFileError', reason: 'FILE_TOO_LARGE' })
  })

  it('rechaza duplicados en modo productivo antes de reprocesar', async () => {
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({ id: 'existing-upload' })),
      },
    }
    const service = makeService(prisma)

    await expect(service.create(makeFile(), '2025-05', false)).rejects.toBeInstanceOf(DuplicateUploadError)
  })

  it('mapea resumenes de uploads y rechaza IDs inexistentes', async () => {
    const createdAt = new Date('2025-05-16T12:00:00.000Z')
    const upload = {
      id: 'upload-1',
      originalName: 'reporte.xlsx',
      fileHash: 'hash-1',
      period: '2025-05',
      status: 'DONE',
      rowCount: 10,
      createdAt,
      errorMessage: null,
      _count: { rebates: 2, anomalies: 1, parseErrors: 0 },
    }
    const prisma = {
      upload: {
        findMany: vi.fn(async () => [upload]),
        findUnique: vi.fn().mockResolvedValueOnce(upload).mockResolvedValueOnce(null),
      },
    }
    const service = makeService(prisma)

    await expect(service.list()).resolves.toEqual([
      {
        id: 'upload-1',
        filename: 'reporte.xlsx',
        fileHash: 'hash-1',
        period: '2025-05',
        status: 'DONE',
        rowCount: 10,
        rebateCount: 2,
        anomalyCount: 1,
        parseErrorCount: 0,
        createdAt: createdAt.toISOString(),
        errorMessage: null,
      },
    ])
    await expect(service.list('DONE')).resolves.toHaveLength(1)
    expect(prisma.upload.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: 'DONE' } }),
    )
    await expect(service.findById('upload-1')).resolves.toMatchObject({ id: 'upload-1' })
    await expect(service.findById('missing')).rejects.toBeInstanceOf(UploadNotFoundError)
  })

  it('mapea reintegros y transacciones de lectura sin recalcular', async () => {
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({ id: 'upload-1' })),
      },
      monthlyRebate: {
        findMany: vi.fn(async () => [
          {
            id: 'rebate-1',
            uploadId: 'upload-1',
            userAccount: { accountNumber: '10001', username: 'victor' },
            tier: { level: 1, name: 'Basico' },
            period: '2025-05',
            totalSpentBOB: { toString: () => '100.00' },
            rebatePercent: { toString: () => '1.00' },
            rebateUSDT: { toString: () => '0.07500000' },
            rebateBOB: { toString: () => '1.00' },
            avgExchangeRate: { toString: () => '13.33333333' },
            paidOut: false,
            paidOutAt: null,
            _count: { items: 3 },
          },
        ]),
      },
      ledgerTransaction: {
        findMany: vi.fn(async () => [
          {
            userAccount: { accountNumber: '10001', username: 'victor' },
            amountBOB: { toString: () => '100.00' },
            amountUSDT: { toString: () => '7.50000000' },
            exchangeRate: { toString: () => '13.33333333' },
          },
        ]),
      },
    }
    const service = makeService(prisma)

    await expect(service.listRebates('upload-1')).resolves.toEqual([
      expect.objectContaining({ id: 'rebate-1', userId: 10001, transactionCount: 3 }),
    ])
    await expect(service.listMinimalTransactions('upload-1')).resolves.toEqual([
      {
        userId: 10001,
        amountBOB: '100.00',
        amountUSDT: '7.50000000',
        exchangeRate: '13.33333333',
      },
    ])
  })
})
