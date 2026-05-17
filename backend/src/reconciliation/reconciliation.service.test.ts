import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ReconciliationService } from './reconciliation.service'
import type { PrismaService } from '../prisma/prisma.service'

const decimal = (value: string) => ({ toString: () => value })

const makeService = (prisma: unknown): ReconciliationService =>
  new ReconciliationService(prisma as PrismaService)

describe('ReconciliationService', () => {
  it('calcula estadisticas agregadas y tasa de conciliacion', async () => {
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({ id: 'upload-1' })),
      },
      reconciliationAnomaly: {
        groupBy: vi.fn(async () => [
          { type: 'NO_EXTRACT', _count: { _all: 1 } },
          { type: 'AMOUNT_MISMATCH', _count: { _all: 1 } },
          { type: 'NO_QR', _count: { _all: 2 } },
        ]),
      },
      ledgerTransaction: {
        count: vi.fn(async () => 4),
      },
    }

    const result = await makeService(prisma).stats('upload-1')

    expect(result).toEqual({
      uploadId: 'upload-1',
      total: 4,
      noExtract: 1,
      noQr: 2,
      amountMismatch: 1,
      invalidRate: 0,
      reconciliationRate: '50.00',
    })
    expect(prisma.ledgerTransaction.count).toHaveBeenCalledWith({
      where: { uploadId: 'upload-1', serviceCode: 'S-001' },
    })
  })

  it('lista anomalías normalizando decimales y fechas para API', async () => {
    const resolvedAt = new Date('2025-05-16T12:00:00.000Z')
    const prisma = {
      upload: {
        findUnique: vi.fn(async () => ({ id: 'upload-1' })),
      },
      reconciliationAnomaly: {
        findMany: vi.fn(async () => [
          {
            id: 'anom-1',
            uploadId: 'upload-1',
            transactionId: 'tx-1',
            type: 'AMOUNT_MISMATCH',
            ledgerAmountBOB: decimal('10.00'),
            extractAmountBOB: decimal('9.50'),
            deltaBOB: decimal('0.50'),
            resolved: true,
            resolvedAt,
            resolutionNote: 'manual',
          },
        ]),
      },
    }

    await expect(makeService(prisma).list('upload-1')).resolves.toEqual([
      {
        id: 'anom-1',
        uploadId: 'upload-1',
        transactionId: 'tx-1',
        type: 'AMOUNT_MISMATCH',
        qrAmountBOB: '10.00',
        extractAmountBOB: '9.50',
        deltaBOB: '0.50',
        resolved: true,
        resolvedAt: resolvedAt.toISOString(),
        resolvedNote: 'manual',
      },
    ])
  })

  it('resuelve una anomalia existente y rechaza IDs inexistentes', async () => {
    const resolvedAt = new Date('2025-05-16T12:00:00.000Z')
    const prisma = {
      reconciliationAnomaly: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 'anom-1' })
          .mockResolvedValueOnce(null),
        update: vi.fn(async () => ({
          id: 'anom-1',
          uploadId: 'upload-1',
          transactionId: 'tx-1',
          type: 'NO_EXTRACT',
          ledgerAmountBOB: decimal('10.00'),
          extractAmountBOB: null,
          deltaBOB: null,
          resolved: true,
          resolvedAt,
          resolutionNote: 'ok',
        })),
      },
    }
    const service = makeService(prisma)

    await expect(service.resolve('anom-1', 'ok')).resolves.toMatchObject({
      id: 'anom-1',
      resolved: true,
      resolvedNote: 'ok',
    })
    await expect(service.resolve('missing')).rejects.toBeInstanceOf(NotFoundException)
  })
})
