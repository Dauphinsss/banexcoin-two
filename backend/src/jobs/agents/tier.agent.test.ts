import { describe, expect, it, vi } from 'vitest'
import type { CashbackTierDTO } from '@banex/types'
import type { QRTransactionRaw } from '../../parser/parser.types'
import { TierAgent } from './tier.agent'

const makeTier = (overrides?: Partial<CashbackTierDTO>): CashbackTierDTO => ({
  id: 'tier-1',
  level: 1,
  name: 'Basico',
  minAmountBOB: '0',
  maxAmountBOB: '500',
  rebatePercent: '1.00',
  active: true,
  validFromPeriod: '2025-01',
  validToPeriod: null,
  ...overrides,
})

const makeRow = (overrides?: Partial<QRTransactionRaw>): QRTransactionRaw => ({
  rowNumber: 2,
  transactionId: 'tx-1',
  username: 'victor',
  accountNumber: 10001,
  amountUSDT: '10',
  amountBOB: '130',
  exchangeRate: '13',
  commission: '0',
  status: 'Completed',
  serviceCode: 'S-001',
  quoteNumber: null,
  transactedAt: new Date('2025-04-15T00:00:00.000Z'),
  raw: {},
  ...overrides,
})

describe('TierAgent', () => {
  it('calcula reintegros deterministas usando los tiers activos del periodo', async () => {
    const listActive = vi.fn(async () => [
      makeTier(),
      makeTier({
        id: 'tier-2',
        level: 2,
        name: 'Bronce',
        minAmountBOB: '500.01',
        maxAmountBOB: '1000',
        rebatePercent: '1.50',
      }),
    ])

    const agent = new TierAgent({ listActive } as unknown as ConstructorParameters<typeof TierAgent>[0])

    const result = await agent.run('2025-04', [
      makeRow({ transactionId: 'tx-1', accountNumber: 10001, amountBOB: '200', amountUSDT: '15.38461538' }),
      makeRow({ transactionId: 'tx-2', accountNumber: 10001, amountBOB: '300', amountUSDT: '23.07692308' }),
      makeRow({ transactionId: 'tx-3', accountNumber: 10002, amountBOB: '700', amountUSDT: '50', exchangeRate: '14' }),
    ])

    expect(listActive).toHaveBeenCalledWith('2025-04')
    expect(result).toEqual([
      {
        userId: 10001,
        totalSpentBOB: '500.00',
        avgExchangeRate: '13.00000000',
        tierId: 1,
        tierName: 'Basico',
        rebatePercent: '1.00',
        rebateBOB: '5.00',
        rebateUSDT: '0.38461538',
        transactionCount: 2,
      },
      {
        userId: 10002,
        totalSpentBOB: '700.00',
        avgExchangeRate: '14.00000000',
        tierId: 2,
        tierName: 'Bronce',
        rebatePercent: '1.50',
        rebateBOB: '10.50',
        rebateUSDT: '0.75000000',
        transactionCount: 1,
      },
    ])
  })

  it('falla con error claro si no hay tiers activos', async () => {
    const agent = new TierAgent({
      listActive: vi.fn(async () => []),
    } as unknown as ConstructorParameters<typeof TierAgent>[0])

    await expect(agent.run('2025-04', [makeRow()])).rejects.toThrow(
      'No hay tiers activos para el periodo 2025-04.',
    )
  })
})
