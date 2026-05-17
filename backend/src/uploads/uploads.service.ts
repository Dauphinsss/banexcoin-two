import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { D } from '@banex/utils'
import { randomUUID } from 'node:crypto'
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
const PROCESS_UPLOAD_TRANSACTION_TIMEOUT_MS = 60_000
const PROCESS_UPLOAD_TRANSACTION_MAX_WAIT_MS = 10_000
const CREATE_MANY_BATCH_SIZE = 1_000
const UPLOAD_OVERWRITE_USER_NAMES = 'UPLOAD_OVERWRITE_USER_NAMES'
const UPLOAD_DUPLICATE_MODE = 'UPLOAD_DUPLICATE_MODE'
const PROCESS_UPLOAD_TRANSACTION_OPTIONS = {
  maxWait: PROCESS_UPLOAD_TRANSACTION_MAX_WAIT_MS,
  timeout: PROCESS_UPLOAD_TRANSACTION_TIMEOUT_MS,
} as const

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  private readonly maxBytes: number
  private readonly overwriteUserNamesOnUpload: boolean
  private readonly duplicateMode: 'prod' | 'test'

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FileStorageService)
    private readonly storage: FileStorageService,
    @Inject(ParserService)
    private readonly parser: ParserService,
    @Inject(TierAgent)
    private readonly tierAgent: TierAgent,
    @Inject(ReconcileAgent)
    private readonly reconcileAgent: ReconcileAgent,
    @Inject(TiersService)
    private readonly tiers: TiersService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {
    const maxMb = Number(this.config.get<string>('MAX_UPLOAD_SIZE_MB') ?? '50')
    this.maxBytes = maxMb * 1024 * 1024
    this.overwriteUserNamesOnUpload = parseBooleanConfig(
      this.config.get<string>(UPLOAD_OVERWRITE_USER_NAMES),
      false,
    )
    this.duplicateMode = parseDuplicateMode(this.config.get<string>(UPLOAD_DUPLICATE_MODE))
  }

  async create(
    file: Express.Multer.File,
    requestedPeriod: string | undefined,
    allowDuplicate = false,
  ): Promise<CreateUploadResponse> {
    this.validateFile(file)

    const fileHash = await this.storage.hash(file.buffer)

    const existing = await this.prisma.upload.findUnique({
      where: { fileHash },
    })

    if (existing) {
      const canReloadDuplicate = this.duplicateMode === 'test'
      const shouldReload = canReloadDuplicate && allowDuplicate

      if (shouldReload) {
        await this.prisma.upload.update({
          where: { id: existing.id },
          data: {
            status: 'PROCESSING',
            errorMessage: null,
            period: requestedPeriod ?? existing.period,
            rowCount: 0,
            transactionRowCount: 0,
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
          wasDuplicate: true,
        }
      }

      this.logger.log(
        `Upload duplicado detectado · hash=${fileHash.slice(0, 8)} · existingId=${existing.id}`,
      )
      throw new DuplicateUploadError(existing.id, canReloadDuplicate)
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

  async list(status?: UploadStatus): Promise<UploadSummary[]> {
    const uploads = await this.prisma.upload.findMany({
      where: status ? { status } : undefined,
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

  async listUserTransactions(uploadId: string, accountNumber: string) {
    await this.ensureUpload(uploadId)

    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: {
        uploadId,
        serviceCode: 'S-001',
        userAccount: { accountNumber },
      },
      include: {
        userAccount: { select: { accountNumber: true, username: true } },
      },
      orderBy: { transactedAt: 'asc' },
    })

    type Row = (typeof transactions)[number]

    return transactions.map((tx: Row) => ({
      id: tx.id,
      uploadId: tx.uploadId,
      userId: Number(tx.userAccount?.accountNumber ?? 0),
      username: tx.userAccount?.username ?? tx.userAccount?.accountNumber ?? '',
      accountNumber: Number(tx.userAccount?.accountNumber ?? 0),
      transactionId: tx.transactionId,
      status: tx.status ?? 'Unknown',
      amountUSDT: tx.amountUSDT?.toString() ?? '0',
      amountBOB: tx.amountBOB?.toString() ?? '0',
      exchangeRate: tx.exchangeRate?.toString() ?? '0',
      commission: tx.feeBOB?.toString() ?? '0',
      transactedAt: tx.transactedAt?.toISOString() ?? '',
      reconciledWithExtract: tx.reconciledWithExtract ?? false,
      extractMismatch: null,
    }))
  }

  async listMinimalTransactions(uploadId: string) {
    await this.ensureUpload(uploadId)

    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: {
        uploadId,
        serviceCode: 'S-001',
        amountBOB: { not: null },
        amountUSDT: { not: null },
        exchangeRate: { not: null },
      },
      select: {
        userAccount: { select: { accountNumber: true } },
        amountBOB: true,
        amountUSDT: true,
        exchangeRate: true,
      },
      orderBy: { transactionId: 'asc' },
    })

    return transactions.map((transaction) => ({
      userId: Number(transaction.userAccount?.accountNumber ?? 0),
      amountBOB: transaction.amountBOB?.toString() ?? '0',
      amountUSDT: transaction.amountUSDT?.toString() ?? '0',
      exchangeRate: transaction.exchangeRate?.toString() ?? '0',
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

    const accountMap = new Map<
      string,
      { username: string | null; displayName: string | null }
    >()

    for (const row of qrRows) {
      const key = String(row.accountNumber)
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          username: row.username,
          displayName: row.username,
        })
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reconciliationAnomaly.deleteMany({ where: { uploadId } })
      await tx.monthlyRebate.deleteMany({ where: { uploadId } })
      await tx.parseError.deleteMany({ where: { uploadId } })
      await tx.bankExtractEntry.deleteMany({ where: { uploadId } })
      await tx.ledgerTransaction.deleteMany({ where: { uploadId } })

      const accountEntries = [...accountMap.entries()]
      if (accountEntries.length > 0) {
        const accountRows = accountEntries.map(([accountNumber, meta]) => ({
          id: randomUUID(),
          accountNumber,
          username: meta.username,
          displayName: meta.displayName,
        }))

        await createManyInChunks(
          accountRows,
          (data) => tx.$executeRaw`
            INSERT INTO "UserAccount" (
              "id",
              "accountNumber",
              "username",
              "displayName",
              "active",
              "createdAt",
              "updatedAt"
            )
            VALUES ${Prisma.join(
              data.map((account) => Prisma.sql`
                (
                  ${account.id},
                  ${account.accountNumber},
                  ${account.username},
                  ${account.displayName},
                  true,
                  NOW(),
                  NOW()
                )
              `),
            )}
            ON CONFLICT ("accountNumber") DO UPDATE SET
              ${userAccountConflictSet(this.overwriteUserNamesOnUpload)}
          `,
        )
      }

      const users =
        accountEntries.length > 0
          ? await tx.userAccount.findMany({
              where: {
                accountNumber: {
                  in: accountEntries.map(([accountNumber]) => accountNumber),
                },
              },
              select: {
                id: true,
                accountNumber: true,
              },
            })
          : []

      const userIdByAccount = new Map(
        users.map((user) => [user.accountNumber, user.id]),
      )

      if (qrRows.length > 0) {
        await createManyInChunks(
          qrRows.map((row) => ({
            uploadId,
            userAccountId: requireUserAccountId(
              userIdByAccount,
              row.accountNumber,
            ),
            serviceCode: row.serviceCode,
            serviceName: 'PAGO QR',
            sourceSheet: 'Pago QR',
            sourceRowNumber: row.rowNumber,
            transactionId: row.transactionId,
            status: row.status,
            direction: 'DEBIT',
            productSymbol: 'USDT',
            transactedAt: row.transactedAt,
            amountBOB: row.amountBOB,
            amountUSDT: row.amountUSDT,
            exchangeRate: row.exchangeRate,
            feeBOB: row.commission,
            feeUSDT: '0',
            netAmountBOB: row.amountBOB,
            netAmountUSDT: row.amountUSDT,
            rawRow: JSON.stringify(row.raw),
          })),
          (data) => tx.ledgerTransaction.createMany({ data }),
        )
      }

      if (parsed.extractRows.length > 0) {
        await createManyInChunks(
          parsed.extractRows.map((row) => ({
            uploadId,
            extractKind: 'PAYMENT',
            sourceSheet: 'EXTRACTO DE PAGOS',
            sourceRowNumber: row.rowNumber,
            transactionId: row.transactionId,
            transactedAt: row.transactedAt,
            amountBOB: row.amountBOB,
            rawRow: JSON.stringify(row.raw),
          })),
          (data) => tx.bankExtractEntry.createMany({ data }),
        )
      }

      if (parsed.collectionExtractRows.length > 0) {
        await createManyInChunks(
          parsed.collectionExtractRows.map((row) => ({
            uploadId,
            extractKind: 'COLLECTION',
            sourceSheet: 'EXTRACTO DE COBROS',
            sourceRowNumber: row.rowNumber,
            transactionId: row.transactionId,
            transactedAt: row.transactedAt,
            amountBOB: row.amountBOB,
            rawRow: JSON.stringify(row.raw),
          })),
          (data) => tx.bankExtractEntry.createMany({ data }),
        )
      }

      const persistedQrTransactions = await tx.ledgerTransaction.findMany({
        where: { uploadId, serviceCode: 'S-001' },
        select: {
          id: true,
          transactionId: true,
          userAccountId: true,
          amountBOB: true,
          amountUSDT: true,
          exchangeRate: true,
        },
      })
      const persistedExtractRows = await tx.bankExtractEntry.findMany({
        where: { uploadId },
        select: { id: true, transactionId: true },
      })
      const qrByTransactionId = new Map(
        persistedQrTransactions.map((row) => [row.transactionId, row]),
      )
      const extractIdByTransactionId = new Map(
        persistedExtractRows.map((row) => [row.transactionId, row.id]),
      )

      if (persistedQrTransactions.length > 0) {
        const qrDetails = qrRows.flatMap((row) => {
          const ledger = qrByTransactionId.get(row.transactionId)
          if (!ledger) return []

          return [
            {
              ledgerTransactionId: ledger.id,
              quoteNumber:
                row.quoteNumber === null ? null : String(row.quoteNumber),
              currencyCode: 'BOB',
              paidAmountBOB: row.amountBOB,
              exchangedAmountUSDT: row.amountUSDT,
              createdAtSource: row.transactedAt,
              updatedAtSource: row.transactedAt,
            },
          ]
        })

        await createManyInChunks(qrDetails, (data) =>
          tx.qrTransactionDetail.createMany({ data }),
        )
      }

      if (anomalies.length > 0) {
        await createManyInChunks(
          anomalies.map((anomaly) => ({
            uploadId,
            transactionId: anomaly.transactionId,
            serviceCode: 'S-001',
            type: anomaly.type,
            ledgerTransactionId:
              qrByTransactionId.get(anomaly.transactionId)?.id ?? null,
            bankExtractEntryId:
              extractIdByTransactionId.get(anomaly.transactionId) ?? null,
            ledgerAmountBOB: anomaly.qrAmountBOB,
            extractAmountBOB: anomaly.extractAmountBOB,
            deltaBOB: anomaly.deltaBOB,
          })),
          (data) => tx.reconciliationAnomaly.createMany({ data }),
        )
      }

      const anomalousQrIds = new Set(
        anomalies
          .filter(
            (anomaly) =>
              anomaly.type === 'NO_EXTRACT' ||
              anomaly.type === 'AMOUNT_MISMATCH',
          )
          .map((anomaly) => anomaly.transactionId),
      )
      const reconciledTransactionIds = parsed.extractRows
        .filter((row) => qrByTransactionId.has(row.transactionId))
        .map((row) => row.transactionId)
        .filter((transactionId) => !anomalousQrIds.has(transactionId))

      if (reconciledTransactionIds.length > 0) {
        await tx.ledgerTransaction.updateMany({
          where: {
            uploadId,
            serviceCode: 'S-001',
            transactionId: { in: reconciledTransactionIds },
          },
          data: { reconciledWithExtract: true },
        })
      }

      const totalSpentUSDTByAccount = aggregateUSDT(qrRows)

      if (rebates.length > 0) {
        await createManyInChunks(
          rebates.map((rebate) => ({
            uploadId,
            userAccountId: requireUserAccountId(userIdByAccount, rebate.userId),
            tierId:
              rebate.tierId === null
                ? null
                : (tierIdByLevel.get(rebate.tierId) ?? null),
            period,
            totalSpentBOB: rebate.totalSpentBOB,
            totalSpentUSDT:
              totalSpentUSDTByAccount.get(String(rebate.userId)) ?? '0',
            avgExchangeRate: rebate.avgExchangeRate,
            rebatePercent: rebate.rebatePercent,
            rebateBOB: rebate.rebateBOB,
            rebateUSDT: rebate.rebateUSDT,
          })),
          (data) => tx.monthlyRebate.createMany({ data }),
        )

        const persistedRebates = await tx.monthlyRebate.findMany({
          where: { uploadId },
          select: { id: true, userAccountId: true },
        })
        const rebateIdByUserId = new Map(
          persistedRebates.map((rebate) => [rebate.userAccountId, rebate.id]),
        )
        if (persistedQrTransactions.length > 0) {
          const rebateItems = persistedQrTransactions.flatMap((transaction) => {
            if (!transaction.userAccountId) return []
            if (
              !transaction.amountBOB ||
              !transaction.amountUSDT ||
              !transaction.exchangeRate
            )
              return []

            const monthlyRebateId = rebateIdByUserId.get(
              transaction.userAccountId,
            )
            if (!monthlyRebateId) return []

            return [
              {
                monthlyRebateId,
                ledgerTransactionId: transaction.id,
                amountBOB: transaction.amountBOB,
                amountUSDT: transaction.amountUSDT,
                exchangeRate: transaction.exchangeRate,
              },
            ]
          })

          await createManyInChunks(rebateItems, (data) =>
            tx.monthlyRebateItem.createMany({ data }),
          )
        }
      }

      if (parseErrors.length > 0) {
        await createManyInChunks(
          parseErrors.map((error) => ({
            uploadId,
            sheetName: error.sheetName,
            rowNumber: error.rowNumber,
            message: error.message,
            rawRow: error.rawSnippet,
          })),
          (data) => tx.parseError.createMany({ data }),
        )
      }

      await tx.upload.update({
        where: { id: uploadId },
        data: {
          period,
          status: 'DONE',
          rowCount: qrRows.length,
          transactionRowCount: qrRows.length,
          extractRowCount: parsed.extractRows.length + parsed.collectionExtractRows.length,
          parseErrorCount: parseErrors.length,
          anomalyCount: anomalies.length,
          processedAt: new Date(),
          errorMessage: null,
        },
      })
    }, PROCESS_UPLOAD_TRANSACTION_OPTIONS)
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
    [...totals.entries()].map(([accountNumber, total]) => [
      accountNumber,
      total.toFixed(8),
    ]),
  )
}

const createManyInChunks = async <T>(
  data: T[],
  createBatch: (batch: T[]) => Promise<unknown>,
): Promise<void> => {
  for (let index = 0; index < data.length; index += CREATE_MANY_BATCH_SIZE) {
    await createBatch(data.slice(index, index + CREATE_MANY_BATCH_SIZE))
  }
}

const userAccountConflictSet = (overwriteNames: boolean): Prisma.Sql => {
  if (overwriteNames) {
    return Prisma.sql`
      "username" = EXCLUDED."username",
      "displayName" = EXCLUDED."displayName",
      "active" = true,
      "updatedAt" = NOW()
    `
  }

  return Prisma.sql`
    "active" = true,
    "updatedAt" = NOW()
  `
}

const parseBooleanConfig = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined) return defaultValue

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false

  return defaultValue
}

const parseDuplicateMode = (value: string | undefined): 'prod' | 'test' => {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'test' ? 'test' : 'prod'
}

const normalizeQrRows = (
  rows: QRTransactionRaw[],
): {
  rows: QRTransactionRaw[]
  errors: Array<{
    sheetName: string
    rowNumber: number
    message: string
    rawSnippet: string | null
  }>
} => {
  const seen = new Set<string>()
  const uniqueRows: QRTransactionRaw[] = []
  const errors: Array<{
    sheetName: string
    rowNumber: number
    message: string
    rawSnippet: string | null
  }> = []

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
