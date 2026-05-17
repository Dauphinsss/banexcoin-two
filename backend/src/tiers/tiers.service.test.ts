import { describe, expect, it, vi } from 'vitest'
import { TiersService } from './tiers.service'
import {
  TierInUseError,
  TierNotFoundError,
  TierPeriodLockedError,
  TierPeriodRangeError,
  TierValidationFailedError,
} from './errors/tier.errors'
import type { PrismaService } from '../prisma/prisma.service'

const decimal = (value: string) => ({ toString: () => value })

const tierRow = (overrides?: Record<string, unknown>) => ({
  id: 'tier-1',
  level: 1,
  name: 'Basico',
  minAmountBOB: decimal('0'),
  maxAmountBOB: decimal('500'),
  rebatePercent: decimal('1.00'),
  active: true,
  validFromPeriod: '2025-01',
  validToPeriod: null,
  ...overrides,
})

const makeService = (prisma: unknown): TiersService =>
  new TiersService(prisma as PrismaService)

describe('TiersService', () => {
  it('lista tiers activos por periodo con filtros de vigencia', async () => {
    const prisma = {
      cashbackTier: {
        findMany: vi.fn(async () => [tierRow()]),
      },
    }

    const result = await makeService(prisma).listActive('2025-05')

    expect(prisma.cashbackTier.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        validFromPeriod: { lte: '2025-05' },
        OR: [{ validToPeriod: null }, { validToPeriod: { gte: '2025-05' } }],
      },
      orderBy: [{ level: 'asc' }, { minAmountBOB: 'asc' }],
    })
    expect(result).toEqual([
      {
        id: 'tier-1',
        level: 1,
        name: 'Basico',
        minAmountBOB: '0',
        maxAmountBOB: '500',
        rebatePercent: '1.00',
        active: true,
        validFromPeriod: '2025-01',
        validToPeriod: null,
      },
    ])
  })

  it('lista solo tiers vigentes del periodo actual cuando no se especifica periodo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-17T04:00:00.000Z'))
    const prisma = {
      cashbackTier: {
        findMany: vi.fn(async () => []),
      },
    }

    await makeService(prisma).listActive()

    expect(prisma.cashbackTier.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        validFromPeriod: { lte: '2026-05' },
        OR: [{ validToPeriod: null }, { validToPeriod: { gte: '2026-05' } }],
      },
      orderBy: [{ level: 'asc' }, { minAmountBOB: 'asc' }],
    })
    vi.useRealTimers()
  })

  it('crea un tier si la configuracion resultante es valida', async () => {
    const prisma = {
      cashbackTier: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => tierRow({ id: 'created', maxAmountBOB: null })),
      },
    }

    const result = await makeService(prisma).create({
      level: 1,
      name: 'Basico',
      minAmountBOB: '0',
      rebatePercent: '1.00',
      validFromPeriod: '2025-01',
    })

    expect(prisma.cashbackTier.create).toHaveBeenCalledWith({
      data: {
        level: 1,
        name: 'Basico',
        minAmountBOB: '0',
        maxAmountBOB: null,
        rebatePercent: '1.00',
        validFromPeriod: '2025-01',
        validToPeriod: null,
        active: true,
      },
    })
    expect(result.id).toBe('created')
  })

  it('rechaza crear tiers con rangos solapados', async () => {
    const prisma = {
      cashbackTier: {
        findMany: vi.fn(async () => [tierRow()]),
      },
    }

    await expect(makeService(prisma).create({
      level: 2,
      name: 'Bronce',
      minAmountBOB: '400',
      maxAmountBOB: '900',
      rebatePercent: '1.50',
      validFromPeriod: '2025-01',
    })).rejects.toBeInstanceOf(TierValidationFailedError)
  })

  it('desactiva solo tiers existentes sin reintegros asociados', async () => {
    const prisma = {
      cashbackTier: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(tierRow())
          .mockResolvedValueOnce(tierRow()),
        update: vi.fn(async () => tierRow({ active: false })),
      },
      monthlyRebate: {
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
      },
    }
    const service = makeService(prisma)

    await expect(service.deactivate('missing')).rejects.toBeInstanceOf(TierNotFoundError)
    await expect(service.deactivate('tier-1')).rejects.toBeInstanceOf(TierInUseError)
    await expect(service.deactivate('tier-1')).resolves.toMatchObject({ active: false })
  })

  it('publica una configuracion nueva cerrando los tiers vigentes al periodo anterior', async () => {
    const activeRows = [
      tierRow({ id: 'old-1', level: 1, validFromPeriod: '2025-01', validToPeriod: null }),
      tierRow({ id: 'old-2', level: 2, name: 'Bronce', minAmountBOB: decimal('500.01'), validFromPeriod: '2025-01', validToPeriod: null }),
    ]
    const publishedRows = [
      tierRow({ id: 'new-1', level: 1, validFromPeriod: '2025-06' }),
      tierRow({ id: 'new-2', level: 2, name: 'Bronce Nuevo', minAmountBOB: decimal('500.01'), validFromPeriod: '2025-06' }),
    ]
    const tx = {
      cashbackTier: {
        findMany: vi.fn(async () => activeRows.map((tier) => ({
          id: tier.id,
          validFromPeriod: tier.validFromPeriod,
        }))),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
    }
    const prisma = {
      upload: {
        count: vi.fn(async () => 0),
      },
      cashbackTier: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(publishedRows),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    }

    const result = await makeService(prisma).publishConfiguration({
      validFromPeriod: '2025-06',
      tiers: [
        {
          level: 1,
          name: 'Basico',
          minAmountBOB: '0',
          maxAmountBOB: '500',
          rebatePercent: '1.00',
        },
        {
          level: 2,
          name: 'Bronce Nuevo',
          minAmountBOB: '500.01',
          maxAmountBOB: null,
          rebatePercent: '1.50',
        },
      ],
    })

    expect(prisma.upload.count).toHaveBeenCalledWith({
      where: {
        status: 'DONE',
        period: { gte: '2025-06' },
      },
    })
    expect(tx.cashbackTier.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1', 'old-2'] } },
      data: {
        validToPeriod: '2025-05',
        active: true,
      },
    })
    expect(tx.cashbackTier.createMany).toHaveBeenCalledWith({
      data: [
        {
          level: 1,
          name: 'Basico',
          minAmountBOB: '0',
          maxAmountBOB: '500',
          rebatePercent: '1.00',
          validFromPeriod: '2025-06',
          validToPeriod: null,
          active: true,
        },
        {
          level: 2,
          name: 'Bronce Nuevo',
          minAmountBOB: '500.01',
          maxAmountBOB: null,
          rebatePercent: '1.50',
          validFromPeriod: '2025-06',
          validToPeriod: null,
          active: true,
        },
      ],
    })
    expect(result).toHaveLength(2)
  })

  it('reemplaza tiers del mismo periodo dejandolos inactivos y con vigencia cerrada', async () => {
    const tx = {
      cashbackTier: {
        findMany: vi.fn(async () => [
          { id: 'same-1', validFromPeriod: '2025-06' },
          { id: 'same-2', validFromPeriod: '2025-06' },
        ]),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
    }
    const prisma = {
      upload: {
        count: vi.fn(async () => 0),
      },
      cashbackTier: {
        findMany: vi.fn(async () => [tierRow({ id: 'new-1', validFromPeriod: '2025-06' })]),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    }

    await makeService(prisma).publishConfiguration({
      validFromPeriod: '2025-06',
      tiers: [
        {
          level: 1,
          name: 'Basico nuevo',
          minAmountBOB: '0',
          maxAmountBOB: null,
          rebatePercent: '1.00',
        },
      ],
    })

    expect(tx.cashbackTier.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['same-1', 'same-2'] } },
      data: {
        active: false,
        validToPeriod: '2025-06',
      },
    })
  })

  it('publica una configuracion con periodo final opcional', async () => {
    const tx = {
      cashbackTier: {
        findMany: vi.fn(async () => []),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
    }
    const prisma = {
      upload: {
        count: vi.fn(async () => 0),
      },
      cashbackTier: {
        findMany: vi.fn(async () => [tierRow({ id: 'new-1', validFromPeriod: '2025-06', validToPeriod: '2025-07' })]),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    }

    await makeService(prisma).publishConfiguration({
      validFromPeriod: '2025-06',
      validToPeriod: '2025-07',
      tiers: [
        {
          level: 1,
          name: 'Temporal',
          minAmountBOB: '0',
          maxAmountBOB: null,
          rebatePercent: '1.00',
        },
      ],
    })

    expect(prisma.upload.count).toHaveBeenCalledWith({
      where: {
        status: 'DONE',
        period: { gte: '2025-06', lte: '2025-07' },
      },
    })
    expect(tx.cashbackTier.createMany).toHaveBeenCalledWith({
      data: [
        {
          level: 1,
          name: 'Temporal',
          minAmountBOB: '0',
          maxAmountBOB: null,
          rebatePercent: '1.00',
          validFromPeriod: '2025-06',
          validToPeriod: '2025-07',
          active: true,
        },
      ],
    })
  })

  it('rechaza publicar una configuracion con periodo final anterior al inicial', async () => {
    const prisma = {
      upload: {
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    await expect(makeService(prisma).publishConfiguration({
      validFromPeriod: '2025-06',
      validToPeriod: '2025-05',
      tiers: [
        {
          level: 1,
          name: 'Temporal',
          minAmountBOB: '0',
          maxAmountBOB: null,
          rebatePercent: '1.00',
        },
      ],
    })).rejects.toBeInstanceOf(TierPeriodRangeError)

    expect(prisma.upload.count).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('bloquea publicar tiers desde un periodo con uploads ya procesados', async () => {
    const prisma = {
      upload: {
        count: vi.fn(async () => 1),
      },
      $transaction: vi.fn(),
    }

    await expect(makeService(prisma).publishConfiguration({
      validFromPeriod: '2025-05',
      tiers: [
        {
          level: 1,
          name: 'Basico',
          minAmountBOB: '0',
          maxAmountBOB: null,
          rebatePercent: '1.00',
        },
      ],
    })).rejects.toBeInstanceOf(TierPeriodLockedError)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
