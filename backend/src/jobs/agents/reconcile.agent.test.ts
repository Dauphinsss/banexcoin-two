import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'
import type { ExtractRowRaw, QRTransactionRaw } from '../../parser/parser.types'
import { ReconcileAgent } from './reconcile.agent'

const makeQr = (overrides?: Partial<QRTransactionRaw>): QRTransactionRaw => ({
  rowNumber: 2,
  transactionId: 'tx-1',
  username: 'victor',
  accountNumber: 10001,
  amountUSDT: '10',
  amountBOB: '130.00',
  exchangeRate: '13',
  commission: '0',
  status: 'Completed',
  serviceCode: 'S-001',
  quoteNumber: null,
  transactedAt: new Date('2025-04-15T00:00:00.000Z'),
  raw: {},
  ...overrides,
})

const makeExtract = (overrides?: Partial<ExtractRowRaw>): ExtractRowRaw => ({
  rowNumber: 3,
  transactionId: 'tx-1',
  amountBOB: '130.00',
  transactedAt: new Date('2025-04-15T00:00:00.000Z'),
  raw: {},
  ...overrides,
})

describe('ReconcileAgent', () => {
  it('clasifica faltantes y diferencias de monto', () => {
    const agent = new ReconcileAgent(new ConfigService())

    const result = agent.run({
      qrRows: [
        makeQr({ transactionId: 'tx-ok', amountBOB: '100.00' }),
        makeQr({ transactionId: 'tx-no-extract', amountBOB: '200.00' }),
        makeQr({ transactionId: 'tx-mismatch', amountBOB: '300.00' }),
      ],
      extractRows: [
        makeExtract({ transactionId: 'tx-ok', amountBOB: '100.00' }),
        makeExtract({ transactionId: 'tx-mismatch', amountBOB: '299.50' }),
        makeExtract({ transactionId: 'tx-no-qr', amountBOB: '80.00' }),
      ],
    })

    expect(result).toEqual([
      {
        transactionId: 'tx-mismatch',
        type: 'AMOUNT_MISMATCH',
        qrAmountBOB: '300.00',
        extractAmountBOB: '299.50',
        deltaBOB: '0.50',
      },
      {
        transactionId: 'tx-no-extract',
        type: 'NO_EXTRACT',
        qrAmountBOB: '200.00',
        extractAmountBOB: null,
        deltaBOB: null,
      },
      {
        transactionId: 'tx-no-qr',
        type: 'NO_QR',
        qrAmountBOB: null,
        extractAmountBOB: '80.00',
        deltaBOB: null,
      },
    ])
  })

  it('respeta tolerancia configurable', () => {
    const config = new ConfigService({ RECONCILE_TOLERANCE_BOB: '0.10' })
    const agent = new ReconcileAgent(config)

    const result = agent.run({
      qrRows: [makeQr({ amountBOB: '100.00' })],
      extractRows: [makeExtract({ amountBOB: '99.95' })],
    })

    expect(result).toEqual([])
  })
})
