/**
 * Seed inicial:
 * - 5 niveles de cashback
 * - cuentas operativas de ejemplo
 * - 1 upload semilla
 * - 12 movimientos de muestra cubriendo todos los tipos del Excel
 * - extractos de muestra para conciliacion
 *
 * Ejecutar manualmente con: `bun run --cwd backend prisma:seed`.
 * Este comando borra todos los datos antes de cargar la semilla.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_UPLOAD_HASH = 'seed-hackaton-2026-canonical-ledger-v1'

const SEED_TIERS = [
  { level: 1, name: 'Basico', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1.00' },
  { level: 2, name: 'Bronce', minAmountBOB: '500.01', maxAmountBOB: '1000', rebatePercent: '1.50' },
  { level: 3, name: 'Plata', minAmountBOB: '1000.01', maxAmountBOB: '2500', rebatePercent: '2.00' },
  { level: 4, name: 'Oro', minAmountBOB: '2500.01', maxAmountBOB: '5000', rebatePercent: '2.50' },
  { level: 5, name: 'Platino', minAmountBOB: '5000.01', maxAmountBOB: null, rebatePercent: '3.00' },
] as const

const SEED_USERS = [
  { accountNumber: '10001', username: 'VictorFernandez452024', displayName: 'Victor Fernandez' },
  { accountNumber: '10003', username: 'CristinaSuarez852025', displayName: 'Cristina Suarez' },
  { accountNumber: '10004', username: 'AdrianaLopez212024', displayName: 'Adriana Lopez' },
  { accountNumber: '10008', username: 'AlbertoLeon10007', displayName: 'Alberto Leon' },
  { accountNumber: '10012', username: 'FernandoRodriguez54123', displayName: 'Fernando Rodriguez' },
  { accountNumber: '10021', username: 'MonicaTorres55123', displayName: 'Monica Torres' },
  { accountNumber: '10432', username: 'AdrianaFernandez96007', displayName: 'Adriana Fernandez' },
] as const

type SeedTransaction = {
  accountNumber?: string
  amountBOB?: string | null
  amountUSDT?: string | null
  blockchain?: string | null
  direction?: 'DEBIT' | 'CREDIT'
  exchangeRate?: string | null
  feeBOB?: string | null
  feeUSDT?: string | null
  netAmountBOB?: string | null
  netAmountUSDT?: string | null
  productSymbol?: string | null
  qrDetail?: {
    createdAtSource?: Date
    currencyCode?: string
    exchangedAmountUSDT?: string | null
    paidAmountBOB?: string | null
    quoteNumber?: string
    sideClient?: string
    updatedAtSource?: Date
  }
  rawRow: Record<string, unknown>
  referenceNumber?: string | null
  serviceCode: string
  serviceName: string
  sourceRowNumber: number
  sourceSheet: string
  status?: string | null
  transactionId: string
  transactedAt: Date
  transferDetail?: {
    receiverAccountNumber?: string
    receiverAlias?: string
    senderAccountNumber?: string
    senderAlias?: string
    transferNumber?: string
  }
}

const SEED_TRANSACTIONS: SeedTransaction[] = [
  {
    accountNumber: '10001',
    amountBOB: '5.00',
    amountUSDT: '0.378',
    direction: 'DEBIT',
    exchangeRate: '13.2065',
    feeBOB: '0',
    feeUSDT: '0.03',
    netAmountBOB: '5.00',
    netAmountUSDT: '0.348',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-04-15T13:01:55.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '0.378',
      paidAmountBOB: '5.00',
      quoteNumber: '8',
      sideClient: 'Sell',
      updatedAtSource: new Date('2025-04-15T13:02:17.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '0.378',
      montoPagado: '5',
      numeroCuenta: '10001',
      numeroCotizacion: '8',
      servicio: 'S-001',
      transaccionId: '207681530',
    },
    serviceCode: 'S-001',
    serviceName: 'PAGO QR',
    sourceRowNumber: 2,
    sourceSheet: 'Pago QR',
    status: 'Completed',
    transactionId: '207681530',
    transactedAt: new Date('2025-04-15T13:02:17.000Z'),
  },
  {
    accountNumber: '10001',
    amountBOB: '5.00',
    amountUSDT: '0.378',
    direction: 'DEBIT',
    exchangeRate: '13.2065',
    feeBOB: '0',
    feeUSDT: '0.03',
    netAmountBOB: '5.00',
    netAmountUSDT: '0.348',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-04-15T13:38:18.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '0.378',
      paidAmountBOB: '5.00',
      quoteNumber: '9',
      sideClient: 'Sell',
      updatedAtSource: new Date('2025-04-15T13:38:37.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '0.378',
      montoPagado: '5',
      numeroCuenta: '10001',
      numeroCotizacion: '9',
      servicio: 'S-001',
      transaccionId: '207692950',
    },
    serviceCode: 'S-001',
    serviceName: 'PAGO QR',
    sourceRowNumber: 3,
    sourceSheet: 'Pago QR',
    status: 'Completed',
    transactionId: '207692950',
    transactedAt: new Date('2025-04-15T13:38:37.000Z'),
  },
  {
    accountNumber: '10003',
    amountBOB: '2.00',
    amountUSDT: '0.151',
    direction: 'DEBIT',
    exchangeRate: '13.2065',
    feeBOB: '0',
    feeUSDT: '0.03',
    netAmountBOB: '2.00',
    netAmountUSDT: '0.121',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-04-15T17:58:35.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '0.151',
      paidAmountBOB: '2.00',
      quoteNumber: '12',
      sideClient: 'Sell',
      updatedAtSource: new Date('2025-04-15T17:59:03.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '0.151',
      montoPagado: '2',
      numeroCuenta: '10003',
      numeroCotizacion: '12',
      servicio: 'S-001',
      transaccionId: '6846097010',
    },
    serviceCode: 'S-001',
    serviceName: 'PAGO QR',
    sourceRowNumber: 5,
    sourceSheet: 'Pago QR',
    status: 'Completed',
    transactionId: '6846097010',
    transactedAt: new Date('2025-04-15T17:59:03.000Z'),
  },
  {
    accountNumber: '10003',
    amountBOB: '10.00',
    amountUSDT: '0.642',
    direction: 'CREDIT',
    exchangeRate: '15.5728',
    feeBOB: '0',
    feeUSDT: '0.03',
    netAmountBOB: '10.00',
    netAmountUSDT: '0.612',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-05-08T15:59:51.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '0.642',
      paidAmountBOB: '10.00',
      quoteNumber: '237',
      sideClient: 'Buy',
      updatedAtSource: new Date('2025-05-08T16:00:11.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '0.642',
      montoPagado: '10',
      numeroCuenta: '10003',
      numeroCotizacion: '237',
      servicio: 'S-002',
      transaccionId: '6932719430',
    },
    serviceCode: 'S-002',
    serviceName: 'COBRO QR',
    sourceRowNumber: 2,
    sourceSheet: 'Cobro QR',
    status: 'Completed',
    transactionId: '6932719430',
    transactedAt: new Date('2025-05-08T16:00:11.000Z'),
  },
  {
    accountNumber: '10001',
    amountBOB: '15.00',
    amountUSDT: '0.959',
    direction: 'CREDIT',
    exchangeRate: '15.6327',
    feeBOB: '0',
    feeUSDT: '0.03',
    netAmountBOB: '15.00',
    netAmountUSDT: '0.929',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-05-09T00:51:25.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '0.959',
      paidAmountBOB: '15.00',
      quoteNumber: '251',
      sideClient: 'Buy',
      updatedAtSource: new Date('2025-05-09T00:52:46.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '0.959',
      montoPagado: '15',
      numeroCuenta: '10001',
      numeroCotizacion: '251',
      servicio: 'S-002',
      transaccionId: '6935031820',
    },
    serviceCode: 'S-002',
    serviceName: 'COBRO QR',
    sourceRowNumber: 3,
    sourceSheet: 'Cobro QR',
    status: 'Completed',
    transactionId: '6935031820',
    transactedAt: new Date('2025-05-09T00:52:46.000Z'),
  },
  {
    accountNumber: '10021',
    amountBOB: '100.00',
    amountUSDT: '6.401',
    direction: 'CREDIT',
    exchangeRate: '15.6212',
    feeBOB: '0',
    feeUSDT: '0.192',
    netAmountBOB: '100.00',
    netAmountUSDT: '6.209',
    productSymbol: 'USDT',
    qrDetail: {
      createdAtSource: new Date('2025-05-09T13:54:36.000Z'),
      currencyCode: 'BOB',
      exchangedAmountUSDT: '6.401',
      paidAmountBOB: '100.00',
      quoteNumber: '259',
      sideClient: 'Buy',
      updatedAtSource: new Date('2025-05-09T13:56:19.000Z'),
    },
    rawRow: {
      estado: 'Completed',
      montoIntercambio: '6.401',
      montoPagado: '100',
      numeroCuenta: '10021',
      numeroCotizacion: '259',
      servicio: 'S-002',
      transaccionId: '215190580',
    },
    serviceCode: 'S-002',
    serviceName: 'COBRO QR',
    sourceRowNumber: 4,
    sourceSheet: 'Cobro QR',
    status: 'Completed',
    transactionId: '215190580',
    transactedAt: new Date('2025-05-09T13:56:19.000Z'),
  },
  {
    accountNumber: '10001',
    amountUSDT: '100.00',
    blockchain: 'Tron',
    direction: 'CREDIT',
    feeUSDT: '0',
    netAmountUSDT: '100.00',
    productSymbol: 'USDT',
    rawRow: {
      accountId: '10001',
      blockchain: 'Tron',
      cryptoQuantity: '100',
      servicio: 'S-004',
      ticketNumber: '1',
    },
    referenceNumber: '1',
    serviceCode: 'S-004',
    serviceName: 'DEPOSITOS',
    sourceRowNumber: 2,
    sourceSheet: 'Depositos',
    status: 'Fully_processed',
    transactionId: 'DEP-0001',
    transactedAt: new Date('2025-04-11T17:08:45.000Z'),
  },
  {
    accountNumber: '10432',
    amountUSDT: '105.00',
    blockchain: 'Tron',
    direction: 'CREDIT',
    feeUSDT: '0',
    netAmountUSDT: '105.00',
    productSymbol: 'USDT',
    rawRow: {
      accountId: '10432',
      blockchain: 'Tron',
      cryptoQuantity: '105',
      servicio: 'S-004',
      ticketNumber: '10000000001',
    },
    referenceNumber: '10000000001',
    serviceCode: 'S-004',
    serviceName: 'DEPOSITOS',
    sourceRowNumber: 3,
    sourceSheet: 'Depositos',
    status: 'Fully_processed',
    transactionId: 'DEP-0002',
    transactedAt: new Date('2025-04-11T17:08:45.000Z'),
  },
  {
    accountNumber: '10001',
    amountUSDT: '15.00',
    blockchain: 'Tron',
    direction: 'DEBIT',
    feeUSDT: '0',
    netAmountUSDT: '15.00',
    productSymbol: 'USDT',
    rawRow: {
      accountId: '10001',
      blockchain: 'Tron',
      cryptoFee: '0',
      cryptoQuantity: '15',
      retiroAntesComision: '15',
      servicio: 'S-003',
      ticketNumber: '1',
    },
    referenceNumber: '1',
    serviceCode: 'S-003',
    serviceName: 'RETIROS',
    sourceRowNumber: 2,
    sourceSheet: 'Retiros',
    status: 'Fully_processed',
    transactionId: 'RET-0001',
    transactedAt: new Date('2025-04-11T18:50:39.000Z'),
  },
  {
    accountNumber: '10008',
    amountUSDT: '50.00',
    blockchain: 'Tron',
    direction: 'DEBIT',
    feeUSDT: '0.5',
    netAmountUSDT: '49.5',
    productSymbol: 'USDT',
    rawRow: {
      accountId: '10008',
      blockchain: 'Tron',
      cryptoFee: '0.5',
      cryptoQuantity: '50',
      retiroAntesComision: '49.5',
      servicio: 'S-003',
      ticketNumber: '4',
    },
    referenceNumber: '4',
    serviceCode: 'S-003',
    serviceName: 'RETIROS',
    sourceRowNumber: 5,
    sourceSheet: 'Retiros',
    status: 'Fully_processed',
    transactionId: 'RET-0002',
    transactedAt: new Date('2025-05-02T09:38:01.000Z'),
  },
  {
    accountNumber: '10001',
    amountUSDT: '10.00',
    direction: 'DEBIT',
    netAmountUSDT: '10.00',
    productSymbol: 'USDT',
    rawRow: {
      amount: '10',
      receiverAccount: '10003',
      senderAccount: '10001',
      servicio: 'S-005',
      transferNumber: '1',
    },
    referenceNumber: '1',
    serviceCode: 'S-005',
    serviceName: 'TRANSFERS',
    sourceRowNumber: 2,
    sourceSheet: 'Transfers',
    status: 'Completed',
    transactionId: 'TRF-0001',
    transactedAt: new Date('2025-04-15T18:11:50.000Z'),
    transferDetail: {
      receiverAccountNumber: '10003',
      receiverAlias: 'CristinaSuarez852025',
      senderAccountNumber: '10001',
      senderAlias: 'VictorFernandez452024',
      transferNumber: '1',
    },
  },
  {
    accountNumber: '10003',
    amountUSDT: '6.00',
    direction: 'DEBIT',
    netAmountUSDT: '6.00',
    productSymbol: 'USDT',
    rawRow: {
      amount: '6',
      receiverAccount: '10001',
      senderAccount: '10003',
      servicio: 'S-005',
      transferNumber: '2',
    },
    referenceNumber: '2',
    serviceCode: 'S-005',
    serviceName: 'TRANSFERS',
    sourceRowNumber: 3,
    sourceSheet: 'Transfers',
    status: 'Completed',
    transactionId: 'TRF-0002',
    transactedAt: new Date('2025-04-15T18:14:50.000Z'),
    transferDetail: {
      receiverAccountNumber: '10001',
      receiverAlias: 'VictorFernandez452024',
      senderAccountNumber: '10003',
      senderAlias: 'CristinaSuarez852025',
      transferNumber: '2',
    },
  },
]

const SEED_EXTRACT_ENTRIES = [
  {
    amountBOB: '-5.00',
    extractKind: 'PAYMENT',
    rawRow: { fecha: '15/04/2025', hora: '09:02', importe: '-5', transaccionId: '207681530' },
    sourceRowNumber: 3,
    sourceSheet: 'EXTRACTO DE PAGOS',
    transactionId: '207681530',
    transactedAt: new Date('2025-04-15T13:02:15.000Z'),
  },
  {
    amountBOB: '-5.00',
    extractKind: 'PAYMENT',
    rawRow: { fecha: '15/04/2025', hora: '09:38', importe: '-5', transaccionId: '207692950' },
    sourceRowNumber: 4,
    sourceSheet: 'EXTRACTO DE PAGOS',
    transactionId: '207692950',
    transactedAt: new Date('2025-04-15T13:38:23.000Z'),
  },
  {
    amountBOB: '-1.50',
    extractKind: 'PAYMENT',
    rawRow: { fecha: '15/04/2025', hora: '13:58', importe: '-1.5', transaccionId: '6846097010' },
    sourceRowNumber: 6,
    sourceSheet: 'EXTRACTO DE PAGOS',
    transactionId: '6846097010',
    transactedAt: new Date('2025-04-15T17:58:59.000Z'),
  },
  {
    amountBOB: '10.00',
    extractKind: 'COLLECTION',
    rawRow: { fecha: '08/05/2025', hora: '12:00', importe: '10', transaccionId: '6932719430' },
    sourceRowNumber: 3,
    sourceSheet: 'EXTRACTO DE COBROS',
    transactionId: '6932719430',
    transactedAt: new Date('2025-05-08T16:00:02.000Z'),
  },
  {
    amountBOB: '15.00',
    extractKind: 'COLLECTION',
    rawRow: { fecha: '08/05/2025', hora: '20:52', importe: '15', transaccionId: '6935031820' },
    sourceRowNumber: 4,
    sourceSheet: 'EXTRACTO DE COBROS',
    transactionId: '6935031820',
    transactedAt: new Date('2025-05-09T00:52:30.000Z'),
  },
  {
    amountBOB: '100.00',
    extractKind: 'COLLECTION',
    rawRow: { fecha: '09/05/2025', hora: '09:56', importe: '100', transaccionId: '215190580' },
    sourceRowNumber: 5,
    sourceSheet: 'EXTRACTO DE COBROS',
    transactionId: '215190580',
    transactedAt: new Date('2025-05-09T13:56:10.000Z'),
  },
] as const

async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.monthlyRebateItem.deleteMany(),
    prisma.reconciliationAnomaly.deleteMany(),
    prisma.generatedReport.deleteMany(),
    prisma.parseError.deleteMany(),
    prisma.bankExtractEntry.deleteMany(),
    prisma.qrTransactionDetail.deleteMany(),
    prisma.transferDetail.deleteMany(),
    prisma.monthlyRebate.deleteMany(),
    prisma.ledgerTransaction.deleteMany(),
    prisma.upload.deleteMany(),
    prisma.cashbackTier.deleteMany(),
    prisma.userAccount.deleteMany(),
  ])
}

async function seedCashbackTiers(): Promise<void> {
  const validFromPeriod = '2025-01'
  const validToPeriod = null

  for (const tier of SEED_TIERS) {
    const existing = await prisma.cashbackTier.findFirst({
      where: {
        level: tier.level,
        validFromPeriod,
      },
    })

    if (existing) {
      await prisma.cashbackTier.update({
        where: { id: existing.id },
        data: {
          name: tier.name,
          minAmountBOB: tier.minAmountBOB,
          maxAmountBOB: tier.maxAmountBOB,
          rebatePercent: tier.rebatePercent,
          validToPeriod,
          active: true,
        },
      })
      continue
    }

    await prisma.cashbackTier.create({
      data: {
        level: tier.level,
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
        validFromPeriod,
        validToPeriod,
        active: true,
      },
    })
  }
}

async function seedTransactionsScenario(): Promise<void> {
  await prisma.$transaction(async (txClient) => {
    for (const user of SEED_USERS) {
      await txClient.userAccount.create({
        data: {
          accountNumber: user.accountNumber,
          username: user.username,
          displayName: user.displayName,
          active: true,
        },
      })
    }

    const upload = await txClient.upload.create({
      data: {
        originalName: 'Reportes Banexcoin Bolivia Hackaton 2026.xlsx',
        storagePath: './data/uploads/seed-hackaton-2026.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 245760,
        fileHash: DEMO_UPLOAD_HASH,
        period: '2025-05',
        status: 'DONE',
        rowCount: 18,
        transactionRowCount: SEED_TRANSACTIONS.length,
        extractRowCount: SEED_EXTRACT_ENTRIES.length,
        parseErrorCount: 0,
        anomalyCount: 1,
        processedAt: new Date('2025-05-16T18:00:00.000Z'),
      },
    })

    const accounts = await txClient.userAccount.findMany({
      where: {
        accountNumber: {
          in: SEED_USERS.map((user) => user.accountNumber),
        },
      },
    })

    const accountsByNumber = new Map(accounts.map((account) => [account.accountNumber, account]))

    const ledgerByKey = new Map<string, { id: string; serviceCode: string; transactionId: string }>()

    for (const tx of SEED_TRANSACTIONS) {
      const userAccountId = tx.accountNumber ? accountsByNumber.get(tx.accountNumber)?.id ?? null : null

      const ledger = await txClient.ledgerTransaction.create({
        data: {
          uploadId: upload.id,
          userAccountId,
          serviceCode: tx.serviceCode,
          serviceName: tx.serviceName,
          sourceSheet: tx.sourceSheet,
          sourceRowNumber: tx.sourceRowNumber,
          transactionId: tx.transactionId,
          referenceNumber: tx.referenceNumber ?? null,
          status: tx.status ?? null,
          direction: tx.direction ?? null,
          productSymbol: tx.productSymbol ?? null,
          blockchain: tx.blockchain ?? null,
          amountBOB: tx.amountBOB ?? null,
          amountUSDT: tx.amountUSDT ?? null,
          feeBOB: tx.feeBOB ?? null,
          feeUSDT: tx.feeUSDT ?? null,
          netAmountBOB: tx.netAmountBOB ?? null,
          netAmountUSDT: tx.netAmountUSDT ?? null,
          exchangeRate: tx.exchangeRate ?? null,
          transactedAt: tx.transactedAt,
          rawRow: JSON.stringify(tx.rawRow),
        },
      })

      ledgerByKey.set(`${tx.serviceCode}:${tx.transactionId}`, {
        id: ledger.id,
        serviceCode: tx.serviceCode,
        transactionId: tx.transactionId,
      })

      if (tx.qrDetail) {
        await txClient.qrTransactionDetail.create({
          data: {
            ledgerTransactionId: ledger.id,
            quoteNumber: tx.qrDetail.quoteNumber ?? null,
            sideClient: tx.qrDetail.sideClient ?? null,
            currencyCode: tx.qrDetail.currencyCode ?? null,
            paidAmountBOB: tx.qrDetail.paidAmountBOB ?? null,
            exchangedAmountUSDT: tx.qrDetail.exchangedAmountUSDT ?? null,
            createdAtSource: tx.qrDetail.createdAtSource ?? null,
            updatedAtSource: tx.qrDetail.updatedAtSource ?? null,
          },
        })
      }

      if (tx.transferDetail) {
        const senderUserAccountId = tx.transferDetail.senderAccountNumber
          ? accountsByNumber.get(tx.transferDetail.senderAccountNumber)?.id ?? null
          : null
        const receiverUserAccountId = tx.transferDetail.receiverAccountNumber
          ? accountsByNumber.get(tx.transferDetail.receiverAccountNumber)?.id ?? null
          : null

        await txClient.transferDetail.create({
          data: {
            ledgerTransactionId: ledger.id,
            transferNumber: tx.transferDetail.transferNumber ?? null,
            senderUserAccountId,
            receiverUserAccountId,
            senderAlias: tx.transferDetail.senderAlias ?? null,
            receiverAlias: tx.transferDetail.receiverAlias ?? null,
          },
        })
      }
    }

    for (const entry of SEED_EXTRACT_ENTRIES) {
      await txClient.bankExtractEntry.create({
        data: {
          uploadId: upload.id,
          extractKind: entry.extractKind,
          sourceSheet: entry.sourceSheet,
          sourceRowNumber: entry.sourceRowNumber,
          transactionId: entry.transactionId,
          transactedAt: entry.transactedAt,
          amountBOB: entry.amountBOB,
          rawRow: JSON.stringify(entry.rawRow),
        },
      })
    }

  const matchedTransactionIds = ['207681530', '207692950']
    await txClient.ledgerTransaction.updateMany({
    where: {
      uploadId: upload.id,
      transactionId: { in: matchedTransactionIds },
    },
    data: { reconciledWithExtract: true },
  })

    const mismatchLedger = await txClient.ledgerTransaction.findFirstOrThrow({
    where: { uploadId: upload.id, transactionId: '6846097010' },
    select: { id: true },
  })

    const mismatchExtract = await txClient.bankExtractEntry.findFirstOrThrow({
    where: { uploadId: upload.id, transactionId: '6846097010' },
    select: { id: true },
  })

    await txClient.reconciliationAnomaly.create({
    data: {
      uploadId: upload.id,
      ledgerTransactionId: mismatchLedger.id,
      bankExtractEntryId: mismatchExtract.id,
      transactionId: '6846097010',
      serviceCode: 'S-001',
      type: 'AMOUNT_MISMATCH',
      ledgerAmountBOB: '2.00',
      extractAmountBOB: '1.50',
      deltaBOB: '0.50',
    },
  })

    const cashbackTier = await txClient.cashbackTier.findFirst({
    where: {
      level: 1,
      validFromPeriod: '2025-01',
    },
  })

  const victor = accountsByNumber.get('10001')
  const cristina = accountsByNumber.get('10003')

  if (cashbackTier && victor && cristina) {
      const victorRebate = await txClient.monthlyRebate.create({
      data: {
        uploadId: upload.id,
        userAccountId: victor.id,
        tierId: cashbackTier.id,
        period: '2025-05',
        totalSpentBOB: '10.00',
        totalSpentUSDT: '0.756',
        avgExchangeRate: '13.2065',
        rebatePercent: cashbackTier.rebatePercent,
        rebateBOB: '0.10',
        rebateUSDT: '0.00756',
        payoutStatus: 'PENDING',
      },
    })

      const cristinaRebate = await txClient.monthlyRebate.create({
      data: {
        uploadId: upload.id,
        userAccountId: cristina.id,
        tierId: cashbackTier.id,
        period: '2025-05',
        totalSpentBOB: '2.00',
        totalSpentUSDT: '0.151',
        avgExchangeRate: '13.2065',
        rebatePercent: cashbackTier.rebatePercent,
        rebateBOB: '0.02',
        rebateUSDT: '0.00151',
        payoutStatus: 'PENDING',
      },
    })

    const victorKeys = ['S-001:207681530', 'S-001:207692950']
    const cristinaKeys = ['S-001:6846097010']

    for (const key of victorKeys) {
      const ledger = ledgerByKey.get(key)
      if (!ledger) continue

        await txClient.monthlyRebateItem.create({
        data: {
          monthlyRebateId: victorRebate.id,
          ledgerTransactionId: ledger.id,
          amountBOB: '5.00',
          amountUSDT: '0.378',
          exchangeRate: '13.2065',
        },
      })
    }

    for (const key of cristinaKeys) {
      const ledger = ledgerByKey.get(key)
      if (!ledger) continue

        await txClient.monthlyRebateItem.create({
        data: {
          monthlyRebateId: cristinaRebate.id,
          ledgerTransactionId: ledger.id,
          amountBOB: '2.00',
          amountUSDT: '0.151',
          exchangeRate: '13.2065',
        },
      })
    }
    }
  })
}

async function main(): Promise<void> {
  await resetDatabase()
  await seedCashbackTiers()
  await seedTransactionsScenario()

  console.log(
    `Seed completado: ${SEED_TIERS.length} tiers, ${SEED_USERS.length} cuentas, ${SEED_TRANSACTIONS.length} movimientos y ${SEED_EXTRACT_ENTRIES.length} extractos.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
