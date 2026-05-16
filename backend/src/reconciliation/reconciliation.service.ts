import { Injectable, NotFoundException } from '@nestjs/common'
import { D } from '@banex/utils'
import type { AnomalyDTO, ReconciliationStats } from '@banex/types'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(uploadId: string): Promise<ReconciliationStats> {
    await this.ensureUpload(uploadId)

    const [counts, qrCount] = await Promise.all([
      this.prisma.reconciliationAnomaly.groupBy({
        by: ['type'],
        where: { uploadId },
        _count: { _all: true },
      }),
      this.prisma.qRTransaction.count({ where: { uploadId } }),
    ])

    const byType = new Map(counts.map((row) => [row.type, row._count._all]))
    const noExtract = byType.get('NO_EXTRACT') ?? 0
    const noQr = byType.get('NO_QR') ?? 0
    const amountMismatch = byType.get('AMOUNT_MISMATCH') ?? 0
    const invalidRate = byType.get('INVALID_RATE') ?? 0
    const total = noExtract + noQr + amountMismatch + invalidRate
    const failedQr = noExtract + amountMismatch + invalidRate
    const reconciliationRate = qrCount === 0
      ? '0.00'
      : D(qrCount - failedQr).dividedBy(qrCount).times(100).toFixed(2)

    return {
      uploadId,
      total,
      noExtract,
      noQr,
      amountMismatch,
      invalidRate,
      reconciliationRate,
    }
  }

  async list(uploadId: string): Promise<AnomalyDTO[]> {
    await this.ensureUpload(uploadId)

    const anomalies = await this.prisma.reconciliationAnomaly.findMany({
      where: { uploadId },
      orderBy: [{ resolved: 'asc' }, { type: 'asc' }, { transactionId: 'asc' }],
    })

    return anomalies.map((anomaly) => ({
      id: anomaly.id,
      uploadId: anomaly.uploadId,
      transactionId: anomaly.transactionId,
      type: anomaly.type as AnomalyDTO['type'],
      qrAmountBOB: anomaly.qrAmountBOB?.toString() ?? null,
      extractAmountBOB: anomaly.extractAmountBOB?.toString() ?? null,
      deltaBOB: anomaly.deltaBOB?.toString() ?? null,
      resolved: anomaly.resolved,
      resolvedAt: anomaly.resolvedAt?.toISOString() ?? null,
      resolvedNote: anomaly.resolutionNote,
    }))
  }

  async resolve(anomalyId: string, note?: string): Promise<AnomalyDTO> {
    const anomaly = await this.prisma.reconciliationAnomaly.findUnique({
      where: { id: anomalyId },
    })
    if (!anomaly) throw new NotFoundException(`No existe la anomalía ${anomalyId}.`)

    const updated = await this.prisma.reconciliationAnomaly.update({
      where: { id: anomalyId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolutionNote: note ?? null,
      },
    })

    return {
      id: updated.id,
      uploadId: updated.uploadId,
      transactionId: updated.transactionId,
      type: updated.type as AnomalyDTO['type'],
      qrAmountBOB: updated.qrAmountBOB?.toString() ?? null,
      extractAmountBOB: updated.extractAmountBOB?.toString() ?? null,
      deltaBOB: updated.deltaBOB?.toString() ?? null,
      resolved: updated.resolved,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      resolvedNote: updated.resolutionNote,
    }
  }

  private async ensureUpload(uploadId: string): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true },
    })
    if (!upload) throw new NotFoundException(`No existe el upload ${uploadId}.`)
  }
}
