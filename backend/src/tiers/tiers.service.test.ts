import { describe, expect, it, vi } from 'vitest'
import { TiersService } from './tiers.service'
import { TierInUseError, TierNotFoundError, TierValidationFailedError } from './errors/tier.errors'
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
})
