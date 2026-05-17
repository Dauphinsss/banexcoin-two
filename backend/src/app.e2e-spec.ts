import 'reflect-metadata'
import 'dotenv/config'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { PrismaService } from './prisma/prisma.service'

const TEST_ACCOUNT_NUMBER = '990000001'
const TEST_FILE_HASH = 'e2e-postgres-upload-hash'
const TEST_TIER_NAMES = ['E2E Basico', 'E2E Bronce']

describe('App e2e', () => {
  let app: INestApplication
  let prisma: PrismaService
  let seededUploadId: string
  let seededAnomalyId: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.UPLOAD_STORAGE_DIR = './data/test-uploads'
    process.env.MAX_UPLOAD_SIZE_MB = '50'
    process.env.GEMINI_API_KEY = ''

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for backend e2e tests.')
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api', { exclude: ['health'] })
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    )

    await app.init()
    prisma = app.get(PrismaService)

    await cleanupE2eData(prisma)

    await prisma.cashbackTier.createMany({
      data: [
        {
          level: 1,
          name: TEST_TIER_NAMES[0],
          minAmountBOB: '0',
          maxAmountBOB: '500',
          rebatePercent: '1.00',
          validFromPeriod: '2025-01',
          active: true,
        },
        {
          level: 2,
          name: TEST_TIER_NAMES[1],
          minAmountBOB: '500.01',
          maxAmountBOB: '1000',
          rebatePercent: '1.50',
          validFromPeriod: '2025-01',
          active: true,
        },
      ],
    })

    const user = await prisma.userAccount.create({
      data: {
        accountNumber: TEST_ACCOUNT_NUMBER,
        username: 'e2e-victor',
        displayName: 'E2E Victor',
        active: true,
      },
    })

    const upload = await prisma.upload.create({
      data: {
        originalName: 'seed-e2e.xlsx',
        storagePath: './data/test-uploads/seed-e2e.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 1024,
        fileHash: TEST_FILE_HASH,
        period: '2025-05',
        status: 'DONE',
        rowCount: 2,
        transactionRowCount: 2,
        extractRowCount: 1,
        parseErrorCount: 0,
        anomalyCount: 1,
        processedAt: new Date('2025-05-16T18:00:00.000Z'),
      },
    })
    seededUploadId = upload.id

    const reconciledTx = await prisma.ledgerTransaction.create({
      data: {
        uploadId: upload.id,
        userAccountId: user.id,
        serviceCode: 'S-001',
        serviceName: 'PAGO QR',
        sourceSheet: 'Pago QR',
        sourceRowNumber: 2,
        transactionId: 'tx-ok',
        status: 'Completed',
        direction: 'DEBIT',
        productSymbol: 'USDT',
        amountBOB: '5.00',
        amountUSDT: '0.37800000',
        exchangeRate: '13.20650000',
        feeBOB: '0',
        feeUSDT: '0',
        netAmountBOB: '5.00',
        netAmountUSDT: '0.37800000',
        transactedAt: new Date('2025-05-16T13:02:17.000Z'),
        reconciledWithExtract: true,
        rawRow: '{}',
      },
    })

    const anomalyTx = await prisma.ledgerTransaction.create({
      data: {
        uploadId: upload.id,
        userAccountId: user.id,
        serviceCode: 'S-001',
        serviceName: 'PAGO QR',
        sourceSheet: 'Pago QR',
        sourceRowNumber: 3,
        transactionId: 'tx-anomaly',
        status: 'Completed',
        direction: 'DEBIT',
        productSymbol: 'USDT',
        amountBOB: '7.00',
        amountUSDT: '0.53000000',
        exchangeRate: '13.20000000',
        feeBOB: '0',
        feeUSDT: '0',
        netAmountBOB: '7.00',
        netAmountUSDT: '0.53000000',
        transactedAt: new Date('2025-05-16T13:05:17.000Z'),
        reconciledWithExtract: false,
        rawRow: '{}',
      },
    })

    const extract = await prisma.bankExtractEntry.create({
      data: {
        uploadId: upload.id,
        extractKind: 'PAYMENT',
        sourceSheet: 'EXTRACTO DE PAGOS',
        sourceRowNumber: 4,
        transactionId: 'tx-anomaly',
        transactedAt: new Date('2025-05-16T13:05:18.000Z'),
        amountBOB: '6.50',
        rawRow: '{}',
      },
    })

    const anomaly = await prisma.reconciliationAnomaly.create({
      data: {
        uploadId: upload.id,
        ledgerTransactionId: anomalyTx.id,
        bankExtractEntryId: extract.id,
        transactionId: 'tx-anomaly',
        serviceCode: 'S-001',
        type: 'AMOUNT_MISMATCH',
        ledgerAmountBOB: '7.00',
        extractAmountBOB: '6.50',
        deltaBOB: '0.50',
        resolved: false,
      },
    })
    seededAnomalyId = anomaly.id

    const tier = await prisma.cashbackTier.findFirstOrThrow({ where: { name: TEST_TIER_NAMES[0] } })

    const rebate = await prisma.monthlyRebate.create({
      data: {
        uploadId: upload.id,
        userAccountId: user.id,
        tierId: tier.id,
        period: '2025-05',
        totalSpentBOB: '12.00',
        totalSpentUSDT: '0.90800000',
        avgExchangeRate: '13.20325000',
        rebatePercent: '1.00',
        rebateBOB: '0.12',
        rebateUSDT: '0.00909000',
      },
    })

    await prisma.monthlyRebateItem.createMany({
      data: [
        {
          monthlyRebateId: rebate.id,
          ledgerTransactionId: reconciledTx.id,
          amountBOB: '5.00',
          amountUSDT: '0.37800000',
          exchangeRate: '13.20650000',
        },
        {
          monthlyRebateId: rebate.id,
          ledgerTransactionId: anomalyTx.id,
          amountBOB: '7.00',
          amountUSDT: '0.53000000',
          exchangeRate: '13.20000000',
        },
      ],
    })
  })

  afterAll(async () => {
    if (prisma) await cleanupE2eData(prisma)
    await app?.close()
  })

  it('responde health con base de datos disponible', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'banex-reintegra-api',
      checks: {
        database: { status: 'ok' },
      },
    })
  })

  it('lista tiers activos desde la base de datos', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/tiers?period=2025-04')
      .expect(200)

    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 1,
        name: TEST_TIER_NAMES[0],
        minAmountBOB: '0',
        maxAmountBOB: '500',
        rebatePercent: '1',
      }),
      expect.objectContaining({
        level: 2,
        name: TEST_TIER_NAMES[1],
        minAmountBOB: '500.01',
        maxAmountBOB: '1000',
        rebatePercent: '1.5',
      }),
    ]))
  })

  it('valida tiers y reporta solapamientos sin persistir', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/tiers/validate')
      .send({
        tiers: [
          {
            id: 'tier-a',
            level: 1,
            name: 'Basico',
            minAmountBOB: '0',
            maxAmountBOB: '500',
            rebatePercent: '1.00',
          },
          {
            id: 'tier-b',
            level: 2,
            name: 'Bronce',
            minAmountBOB: '400',
            maxAmountBOB: '900',
            rebatePercent: '1.50',
          },
        ],
      })
      .expect(201)

    expect(response.body.valid).toBe(false)
    expect(response.body.blockingCount).toBeGreaterThan(0)
    expect(response.body.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'OVERLAP',
          severity: 'error',
        }),
      ]),
    )
  })

  it('rechaza upload sin archivo con error controlado', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/uploads')
      .field('period', '2025-04')
      .expect(400)

    expect(response.body).toMatchObject({
      error: 'INVALID_FILE',
      message: 'No se recibió ningún archivo.',
    })
  })

  it('lista transacciones QR por usuario dentro de un upload', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/uploads/${seededUploadId}/users/${TEST_ACCOUNT_NUMBER}/transactions`)
      .expect(200)

    expect(response.body).toHaveLength(2)
    expect(response.body).toEqual([
      expect.objectContaining({
        transactionId: 'tx-ok',
        accountNumber: Number(TEST_ACCOUNT_NUMBER),
        reconciledWithExtract: true,
      }),
      expect.objectContaining({
        transactionId: 'tx-anomaly',
        accountNumber: Number(TEST_ACCOUNT_NUMBER),
        reconciledWithExtract: false,
      }),
    ])
  })

  it('marca una anomalía como resuelta mediante el endpoint de reconciliación', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/reconciliation/anomalies/${seededAnomalyId}/resolve`)
      .send({ note: 'Validated manually' })
      .expect(200)

    expect(response.body).toMatchObject({
      id: seededAnomalyId,
      resolved: true,
      resolvedNote: 'Validated manually',
      type: 'AMOUNT_MISMATCH',
    })

    const persisted = await prisma.reconciliationAnomaly.findUniqueOrThrow({
      where: { id: seededAnomalyId },
    })
    expect(persisted.resolved).toBe(true)
    expect(persisted.resolutionNote).toBe('Validated manually')
  })

  it('explica anomalías con diagnóstico local si IA no está configurada', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reconciliation/explain')
      .send({ uploadId: seededUploadId })
      .expect(200)

    expect(response.body).toMatchObject({
      available: false,
      cached: false,
    })
    expect(response.body.explanation).toContain('Resumen automático')
    expect(response.body.explanation).toContain('monto distinto')
  })

  it('descarga reportes Excel desde los endpoints de uploads', async () => {
    const endpoints = [
      `/api/uploads/${seededUploadId}/report`,
      `/api/uploads/${seededUploadId}/banex-transfer`,
      `/api/uploads/${seededUploadId}/balance-sheet`,
    ]

    for (const endpoint of endpoints) {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .expect(200)

      expect(response.header['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      expect(response.header['content-disposition']).toContain('attachment; filename=')
      expect(Number(response.header['content-length'])).toBeGreaterThan(0)
    }
  })
})

async function cleanupE2eData(prisma: PrismaService): Promise<void> {
  const upload = await prisma.upload.findUnique({
    where: { fileHash: TEST_FILE_HASH },
    select: { id: true },
  })

  if (upload) {
    await prisma.upload.delete({ where: { id: upload.id } })
  }

  await prisma.userAccount.deleteMany({
    where: { accountNumber: TEST_ACCOUNT_NUMBER },
  })

  await prisma.cashbackTier.deleteMany({
    where: { name: { in: TEST_TIER_NAMES } },
  })
}
