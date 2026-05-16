import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { D } from '@banex/utils'
import type {
  CreateUploadResponse,
  MonthlyRebateDTO,
  UploadStatus,
  UploadSummary,
} from '@banex/types'
import type { QRTransactionRaw } from '../parser/parser.types'
import { ParserService } from '../parser/parser.service'
import { ReconcileAgent } from '../jobs/agents/reconcile.agent'
import { TierAgent } from '../jobs/agents/tier.agent'
import { TiersService } from '../tiers/tiers.service'
import { PrismaService } from '../prisma/prisma.service'
import { FileStorageService } from './storage/file-storage.service'
import {
  DuplicateUploadError,
  InvalidFileError,
  UploadNotFoundError,
} from './errors/upload.errors'

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls'])

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  private readonly maxBytes: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly parser: ParserService,
    private readonly tierAgent: TierAgent,
    private readonly reconcileAgent: ReconcileAgent,
    private readonly tiers: TiersService,
    config: ConfigService,
  ) {
    const maxMb = Number(config.get<string>('MAX_UPLOAD_SIZE_MB') ?? '50')
    this.maxBytes = maxMb * 1024 * 1024
  }

  async create(
    file: Express.Multer.File,
    requestedPeriod: string | undefined,
  ): Promise<CreateUploadResponse> {
    this.validateFile(file)

    const fileHash = await this.storage.hash(file.buffer)

    const existing = await this.prisma.upload.findUnique({
      where: { fileHash },
    })

    if (existing) {
      if (existing.status === 'FAILED') {
        await this.prisma.upload.update({
          where: { id: existing.id },
          data: {
            status: 'PROCESSING',
            errorMessage: null,
            period: requestedPeriod ?? existing.period,
            rowCount: 0,
            qrRowCount: 0,
            extractRowCount: 0,
            parseErrorCount: 0,
            anomalyCount: 0,
            processedAt: null,
          },
        })

        try {
          await this.processUpload(existing.id, file, fileHash, requestedPeriod)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Error desconocido procesando upload.'

          await this.prisma.upload.update({
            where: { id: existing.id },
            data: {
              status: 'FAILED',
              errorMessage: message,
            },
          })

          throw error
        }

        return {
          uploadId: existing.id,
          status: 'DONE',
          wasDuplicate: false,
        }
      }

      this.logger.log(
        `Upload duplicado detectado · hash=${fileHash.slice(0, 8)} · existingId=${existing.id}`,
      )
      throw new DuplicateUploadError(existing.id)
    }

    const storagePath = await this.storage.save(fileHash, file.originalname, file.buffer)

    const upload = await this.prisma.upload.create({
      data: {
        originalName: file.originalname,
        storagePath,
        mimeType: file.mimetype || 'application/octet-stream',
        fileHash,
        fileSizeBytes: file.size,
        period: requestedPeriod ?? null,
        status: 'PROCESSING',
        rowCount: 0,
      },
      select: { id: true },
    })

    try {
      await this.processUpload(upload.id, file, fileHash, requestedPeriod)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido procesando upload.'

      await this.prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
        },
      })

      throw error
    }

    this.logger.log(
      `Upload procesado · id=${upload.id} · hash=${fileHash.slice(0, 8)} · bytes=${file.size}`,
    )

    return {
      uploadId: upload.id,
      status: 'DONE',
      wasDuplicate: false,
    }
  }

  async findById(uploadId: string): Promise<UploadSummary> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        _count: {
          select: {
            rebates: true,
            anomalies: true,
            parseErrors: true,
          },
        },
      },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    return {
      id: upload.id,
      filename: upload.originalName,
      fileHash: upload.fileHash,
      period: upload.period,
      status: upload.status as UploadStatus,
      rowCount: upload.rowCount,
      rebateCount: upload._count.rebates,
      anomalyCount: upload._count.anomalies,
      parseErrorCount: upload._count.parseErrors,
      createdAt: upload.createdAt.toISOString(),
      errorMessage: upload.errorMessage,
    }
  }

  async list(): Promise<UploadSummary[]> {
    const uploads = await this.prisma.upload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: {
          select: {
            rebates: true,
            anomalies: true,
            parseErrors: true,
          },
        },
      },
    })

    return uploads.map((upload) => ({
      id: upload.id,
      filename: upload.originalName,
      fileHash: upload.fileHash,
      period: upload.period,
      status: upload.status as UploadStatus,
      rowCount: upload.rowCount,
      rebateCount: upload._count.rebates,
      anomalyCount: upload._count.anomalies,
      parseErrorCount: upload._count.parseErrors,
      createdAt: upload.createdAt.toISOString(),
      errorMessage: upload.errorMessage,
    }))
  }

  async listRebates(uploadId: string): Promise<MonthlyRebateDTO[]> {
    await this.ensureUpload(uploadId)

    const rebates = await this.prisma.monthlyRebate.findMany({
      where: { uploadId },
      orderBy: [{ rebateUSDT: 'desc' }],
      include: {
        userAccount: true,
        tier: true,
        _count: { select: { items: true } },
      },
    })

    return rebates.map((rebate) => ({
      id: rebate.id,
      uploadId: rebate.uploadId,
      userId: Number(rebate.userAccount.accountNumber),
      username: rebate.userAccount.username ?? rebate.userAccount.accountNumber,
      period: rebate.period,
      totalSpentBOB: rebate.totalSpentBOB.toString(),
      tierId: rebate.tier?.level ?? null,
      tierName: rebate.tier?.name ?? null,
      rebatePercent: rebate.rebatePercent.toString(),
      rebateUSDT: rebate.rebateUSDT.toString(),
      rebateBOB: rebate.rebateBOB.toString(),
      avgExchangeRate: rebate.avgExchangeRate.toString(),
      paidOut: rebate.paidOut,
      paidOutAt: rebate.paidOutAt?.toISOString() ?? null,
      transactionCount: rebate._count.items,
    }))
  }

  async listMinimalTransactions(uploadId: string) {
    await this.ensureUpload(uploadId)

    const transactions = await this.prisma.qRTransaction.findMany({
      where: { uploadId },
      select: {
        userAccount: { select: { accountNumber: true } },
        amountBOB: true,
        amountUSDT: true,
        exchangeRate: true,
      },
      orderBy: { transactionId: 'asc' },
    })

    return transactions.map((transaction) => ({
      userId: Number(transaction.userAccount.accountNumber),
      amountBOB: transaction.amountBOB.toString(),
      amountUSDT: transaction.amountUSDT.toString(),
      exchangeRate: transaction.exchangeRate.toString(),
    }))
  }

  private async processUpload(
    uploadId: string,
    file: Express.Multer.File,
    fileHash: string,
    requestedPeriod?: string,
  ): Promise<void> {
    const parsed = await this.parser.parseBuffer(file.buffer, {
      filename: file.originalname,
      fileHash,
    })
    const normalized = normalizeQrRows(parsed.qrRows)
    const qrRows = normalized.rows
    const parseErrors = [...parsed.parseErrors, ...normalized.errors]

    const period = requestedPeriod ?? parsed.period
    if (!period) {
      throw new Error('No se pudo determinar el periodo del archivo.')
    }

    const rebates = await this.tierAgent.run(period, qrRows)
    const anomalies = this.reconcileAgent.run({
      qrRows,
      extractRows: parsed.extractRows,
    })
    const activeTiers = await this.tiers.listActive(period)
    const tierIdByLevel = new Map(activeTiers.map((tier) => [tier.level, tier.id]))

    await this.prisma.$transaction(async (tx) => {
      await tx.reconciliationAnomaly.deleteMany({ where: { uploadId } })
      await tx.monthlyRebate.deleteMany({ where: { uploadId } })
      await tx.parseError.deleteMany({ where: { uploadId } })
      await tx.qRTransaction.deleteMany({ where: { uploadId } })
      await tx.extractTransaction.deleteMany({ where: { uploadId } })

      const accountMap = new Map<string, { username: string | null; displayName: string | null }>()

      for (const row of qrRows) {
        const key = String(row.accountNumber)
        if (!accountMap.has(key)) {
          accountMap.set(key, {
            username: row.username,
            displayName: row.username,
          })
        }
      }

      for (const [accountNumber, meta] of accountMap) {
        await tx.userAccount.upsert({
          where: { accountNumber },
          update: {
            username: meta.username,
            displayName: meta.displayName,
            active: true,
          },
          create: {
            accountNumber,
            username: meta.username,
            displayName: meta.displayName,
            active: true,
          },
        })
      }

      const users = await tx.userAccount.findMany({
        where: {
          accountNumber: { in: [...accountMap.keys()] },
        },
        select: {
          id: true,
          accountNumber: true,
        },
      })

      const userIdByAccount = new Map(users.map((user) => [user.accountNumber, user.id]))

      if (qrRows.length > 0) {
        await tx.qRTransaction.createMany({
          data: qrRows.map((row) => ({
            uploadId,
            userAccountId: requireUserAccountId(userIdByAccount, row.accountNumber),
            transactionId: row.transactionId,
            transactedAt: row.transactedAt,
            amountBOB: row.amountBOB,
            amountUSDT: row.amountUSDT,
            exchangeRate: row.exchangeRate,
            feeBOB: row.commission,
            feeUSDT: '0',
            rawRow: JSON.stringify(row.raw),
          })),
        })
      }

      if (parsed.extractRows.length > 0) {
        await tx.extractTransaction.createMany({
          data: parsed.extractRows.map((row) => ({
            uploadId,
            transactionId: row.transactionId,
            transactedAt: row.transactedAt,
            amountBOB: row.amountBOB,
            rawRow: JSON.stringify(row.raw),
          })),
        })
      }

      const persistedQrRows = await tx.qRTransaction.findMany({
        where: { uploadId },
        select: { id: true, transactionId: true },
      })
      const persistedExtractRows = await tx.extractTransaction.findMany({
        where: { uploadId },
        select: { id: true, transactionId: true },
      })
      const qrIdByTransactionId = new Map(
        persistedQrRows.map((row) => [row.transactionId, row.id]),
      )
      const extractIdByTransactionId = new Map(
        persistedExtractRows.map((row) => [row.transactionId, row.id]),
      )

      if (anomalies.length > 0) {
        await tx.reconciliationAnomaly.createMany({
          data: anomalies.map((anomaly) => ({
            uploadId,
            transactionId: anomaly.transactionId,
            type: anomaly.type,
            qrTransactionId: qrIdByTransactionId.get(anomaly.transactionId) ?? null,
            extractTransactionId: extractIdByTransactionId.get(anomaly.transactionId) ?? null,
            qrAmountBOB: anomaly.qrAmountBOB,
            extractAmountBOB: anomaly.extractAmountBOB,
            deltaBOB: anomaly.deltaBOB,
          })),
        })
      }

      const anomalousQrIds = new Set(
        anomalies
          .filter((anomaly) => anomaly.type === 'NO_EXTRACT' || anomaly.type === 'AMOUNT_MISMATCH')
          .map((anomaly) => anomaly.transactionId),
      )
      const reconciledTransactionIds = parsed.extractRows
        .filter((row) => qrIdByTransactionId.has(row.transactionId))
        .map((row) => row.transactionId)
        .filter((transactionId) => !anomalousQrIds.has(transactionId))

      if (reconciledTransactionIds.length > 0) {
        await tx.qRTransaction.updateMany({
          where: {
            uploadId,
            transactionId: { in: reconciledTransactionIds },
          },
          data: { reconciledWithExtract: true },
        })
      }

      const totalSpentUSDTByAccount = aggregateUSDT(qrRows)

      if (rebates.length > 0) {
        await tx.monthlyRebate.createMany({
          data: rebates.map((rebate) => ({
            uploadId,
            userAccountId: requireUserAccountId(userIdByAccount, rebate.userId),
            tierId: rebate.tierId === null ? null : (tierIdByLevel.get(rebate.tierId) ?? null),
            period,
            totalSpentBOB: rebate.totalSpentBOB,
            totalSpentUSDT: totalSpentUSDTByAccount.get(String(rebate.userId)) ?? '0',
            avgExchangeRate: rebate.avgExchangeRate,
            rebatePercent: rebate.rebatePercent,
            rebateBOB: rebate.rebateBOB,
            rebateUSDT: rebate.rebateUSDT,
          })),
        })

        const persistedRebates = await tx.monthlyRebate.findMany({
          where: { uploadId },
          select: { id: true, userAccountId: true },
        })
        const rebateIdByUserId = new Map(
          persistedRebates.map((rebate) => [rebate.userAccountId, rebate.id]),
        )
        const persistedQrTransactions = await tx.qRTransaction.findMany({
          where: { uploadId },
          select: {
            id: true,
            userAccountId: true,
            amountBOB: true,
            amountUSDT: true,
            exchangeRate: true,
          },
        })

        if (persistedQrTransactions.length > 0) {
          await tx.monthlyRebateItem.createMany({
            data: persistedQrTransactions.flatMap((transaction) => {
              const monthlyRebateId = rebateIdByUserId.get(transaction.userAccountId)
              if (!monthlyRebateId) return []

              return [{
                monthlyRebateId,
                qrTransactionId: transaction.id,
                amountBOB: transaction.amountBOB,
                amountUSDT: transaction.amountUSDT,
                exchangeRate: transaction.exchangeRate,
              }]
            }),
          })
        }
      }

      if (parseErrors.length > 0) {
        await tx.parseError.createMany({
          data: parseErrors.map((error) => ({
            uploadId,
            sheetName: error.sheetName,
            rowNumber: error.rowNumber,
            message: error.message,
            rawRow: error.rawSnippet,
          })),
        })
      }

      await tx.upload.update({
        where: { id: uploadId },
        data: {
          period,
          status: 'DONE',
          rowCount: qrRows.length,
          qrRowCount: qrRows.length,
          extractRowCount: parsed.extractRows.length,
          parseErrorCount: parseErrors.length,
          anomalyCount: anomalies.length,
          processedAt: new Date(),
          errorMessage: null,
        },
      })
    })
  }

  private async ensureUpload(uploadId: string): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true },
    })
    if (!upload) throw new UploadNotFoundError(uploadId)
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new InvalidFileError('NO_FILE', 'No se recibió ningún archivo.')
    }

    if (file.size === 0) {
      throw new InvalidFileError('EMPTY_FILE', 'El archivo está vacío.')
    }

    if (file.size > this.maxBytes) {
      throw new InvalidFileError(
        'FILE_TOO_LARGE',
        `El archivo supera el límite de ${this.maxBytes / 1024 / 1024} MB.`,
      )
    }

    const extension = extractExtension(file.originalname)
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new InvalidFileError(
        'INVALID_EXTENSION',
        `Extensión "${extension}" no permitida. Se aceptan: ${[...ALLOWED_EXTENSIONS].join(', ')}.`,
      )
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new InvalidFileError(
        'INVALID_MIME',
        'Tipo de archivo no permitido. Asegúrate de subir un Excel (.xlsx).',
      )
    }
  }
}

const extractExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) return ''
  return name.slice(lastDot).toLowerCase()
}

const requireUserAccountId = (
  users: ReadonlyMap<string, string>,
  accountNumber: number,
): string => {
  const userId = users.get(String(accountNumber))
  if (!userId) {
    throw new Error(`No se pudo resolver la cuenta ${accountNumber}.`)
  }
  return userId
}

const aggregateUSDT = (rows: QRTransactionRaw[]): Map<string, string> => {
  const totals = new Map<string, ReturnType<typeof D>>()

  for (const row of rows) {
    const key = String(row.accountNumber)
    const current = totals.get(key) ?? D('0')
    totals.set(key, current.plus(D(row.amountUSDT)))
  }

  return new Map(
    [...totals.entries()].map(([accountNumber, total]) => [accountNumber, total.toFixed(8)]),
  )
}

const normalizeQrRows = (
  rows: QRTransactionRaw[],
): { rows: QRTransactionRaw[]; errors: Array<{ sheetName: string; rowNumber: number; message: string; rawSnippet: string | null }> } => {
  const seen = new Set<string>()
  const uniqueRows: QRTransactionRaw[] = []
  const errors: Array<{ sheetName: string; rowNumber: number; message: string; rawSnippet: string | null }> = []

  for (const row of rows) {
    if (seen.has(row.transactionId)) {
      errors.push({
        sheetName: 'Pago QR',
        rowNumber: row.rowNumber,
        message: `Transacción Id duplicado dentro del mismo archivo: ${row.transactionId}`,
        rawSnippet: JSON.stringify(row.raw).slice(0, 200),
      })
      continue
    }

    seen.add(row.transactionId)
    uniqueRows.push(row)
  }

  return { rows: uniqueRows, errors }
}
