import 'reflect-metadata'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { PrismaService } from './prisma/prisma.service'

const TEST_DB_FILE = join(__dirname, '..', 'prisma', 'test-e2e.db')
const TEST_DB_URL = 'file:./test-e2e.db'

describe('App e2e', () => {
  let app: INestApplication
  let prisma: PrismaService
  let seededUploadId: string
  let seededAnomalyId: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = TEST_DB_URL
    process.env.UPLOAD_STORAGE_DIR = './data/test-uploads'
    process.env.MAX_UPLOAD_SIZE_MB = '50'

    if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE)

    execSync('bunx prisma db push --schema prisma/schema.prisma --skip-generate', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'pipe',
    })

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

    await prisma.cashbackTier.createMany({
      data: [
        {
          level: 1,
          name: 'Basico',
          minAmountBOB: '0',
          maxAmountBOB: '500',
          rebatePercent: '1.00',
          validFromPeriod: '2025-01',
          active: true,
        },
        {
          level: 2,
          name: 'Bronce',
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
        accountNumber: '10001',
        username: 'victor',
        displayName: 'Victor',
        active: true,
      },
    })

    const upload = await prisma.upload.create({
      data: {
        originalName: 'seed-e2e.xlsx',
        storagePath: './data/test-uploads/seed-e2e.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 1024,
        fileHash: 'seed-e2e-upload-hash',
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

    const tier = await prisma.cashbackTier.findFirstOrThrow({ where: { level: 1 } })

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
    await app?.close()
    if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE)
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

    expect(response.body).toEqual([
      expect.objectContaining({
        level: 1,
        name: 'Basico',
        minAmountBOB: '0',
        maxAmountBOB: '500',
        rebatePercent: '1',
      }),
      expect.objectContaining({
        level: 2,
        name: 'Bronce',
        minAmountBOB: '500.01',
        maxAmountBOB: '1000',
        rebatePercent: '1.5',
      }),
    ])
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
      .get(`/api/uploads/${seededUploadId}/users/10001/transactions`)
      .expect(200)

    expect(response.body).toHaveLength(2)
    expect(response.body).toEqual([
      expect.objectContaining({
        transactionId: 'tx-ok',
        accountNumber: 10001,
        reconciledWithExtract: true,
      }),
      expect.objectContaining({
        transactionId: 'tx-anomaly',
        accountNumber: 10001,
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
})
