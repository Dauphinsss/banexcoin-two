import { Inject, Injectable, Logger } from '@nestjs/common'
import type { CashbackTierDTO } from '@banex/types'
import { validateTiers, type TierValidationOutput } from '@banex/utils'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateTierDto } from './dto/create-tier.dto'
import type { UpdateTierDto } from './dto/update-tier.dto'
import type { ValidateTiersDto } from './dto/validate-tiers.dto'
import {
  TierInUseError,
  TierNotFoundError,
  TierValidationFailedError,
} from './errors/tier.errors'

@Injectable()
export class TiersService {
  private readonly logger = new Logger(TiersService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Lista los tiers activos vigentes para el período (default: todos los activos). */
  async listActive(period?: string): Promise<CashbackTierDTO[]> {
    const tiers = await this.prisma.cashbackTier.findMany({
      where: {
        active: true,
        ...(period
          ? {
              validFromPeriod: { lte: period },
              OR: [{ validToPeriod: null }, { validToPeriod: { gte: period } }],
            }
          : {}),
      },
      orderBy: [{ level: 'asc' }, { minAmountBOB: 'asc' }],
    })

    return tiers.map(this.toDTO)
  }

  /**
   * Lista TODOS los tiers (incluyendo inactivos) para mostrar historial.
   * Orden cronológico inverso para ver lo más reciente arriba.
   */
  async listAll(): Promise<CashbackTierDTO[]> {
    const tiers = await this.prisma.cashbackTier.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    })
    return tiers.map(this.toDTO)
  }

  async create(dto: CreateTierDto): Promise<CashbackTierDTO> {
    // Validar contra todo el set vigente (los activos del período de aplicación)
    await this.assertValidWith(
      dto.validFromPeriod,
      {
        level: dto.level,
        name: dto.name,
        minAmountBOB: dto.minAmountBOB,
        maxAmountBOB: dto.maxAmountBOB ?? null,
        rebatePercent: dto.rebatePercent,
      },
      null,
    )

    const created = await this.prisma.cashbackTier.create({
      data: {
        level: dto.level,
        name: dto.name,
        minAmountBOB: dto.minAmountBOB,
        maxAmountBOB: dto.maxAmountBOB ?? null,
        rebatePercent: dto.rebatePercent,
        validFromPeriod: dto.validFromPeriod,
        validToPeriod: dto.validToPeriod ?? null,
        active: dto.active ?? true,
      },
    })

    this.logger.log(`Tier creado · id=${created.id} · level=${created.level} · name=${created.name}`)
    return this.toDTO(created)
  }

  async update(id: string, dto: UpdateTierDto): Promise<CashbackTierDTO> {
    const existing = await this.prisma.cashbackTier.findUnique({ where: { id } })
    if (!existing) throw new TierNotFoundError(id)

    const merged = {
      id,
      level: dto.level ?? existing.level,
      name: dto.name ?? existing.name,
      minAmountBOB: dto.minAmountBOB ?? existing.minAmountBOB.toString(),
      maxAmountBOB:
        dto.maxAmountBOB === undefined
          ? existing.maxAmountBOB?.toString() ?? null
          : dto.maxAmountBOB,
      rebatePercent: dto.rebatePercent ?? existing.rebatePercent.toString(),
    }

    const period = dto.validFromPeriod ?? existing.validFromPeriod
    await this.assertValidWith(period, merged, id)

    const updated = await this.prisma.cashbackTier.update({
      where: { id },
      data: {
        level: dto.level ?? existing.level,
        name: dto.name ?? existing.name,
        minAmountBOB: dto.minAmountBOB ?? existing.minAmountBOB,
        maxAmountBOB:
          dto.maxAmountBOB === undefined
            ? existing.maxAmountBOB
            : dto.maxAmountBOB,
        rebatePercent: dto.rebatePercent ?? existing.rebatePercent,
        validFromPeriod: dto.validFromPeriod ?? existing.validFromPeriod,
        validToPeriod:
          dto.validToPeriod === undefined
            ? existing.validToPeriod
            : dto.validToPeriod,
        active: dto.active ?? existing.active,
      },
    })

    this.logger.log(`Tier actualizado · id=${id} · level=${updated.level}`)
    return this.toDTO(updated)
  }

  async deactivate(id: string): Promise<CashbackTierDTO> {
    const existing = await this.prisma.cashbackTier.findUnique({ where: { id } })
    if (!existing) throw new TierNotFoundError(id)

    const inUse = await this.prisma.monthlyRebate.count({ where: { tierId: id } })
    if (inUse > 0) {
      throw new TierInUseError(id, inUse)
    }

    const updated = await this.prisma.cashbackTier.update({
      where: { id },
      data: { active: false },
    })

    this.logger.log(`Tier desactivado · id=${id}`)
    return this.toDTO(updated)
  }

  /**
   * Validación sin persistir. Útil para el simulador y el editor inline.
   * No lanza, devuelve el resultado completo.
   */
  validateOnly(dto: ValidateTiersDto): TierValidationOutput {
    return validateTiers(
      dto.tiers.map((t) => ({
        id: t.id,
        level: t.level,
        name: t.name,
        minAmountBOB: t.minAmountBOB,
        maxAmountBOB: t.maxAmountBOB ?? null,
        rebatePercent: t.rebatePercent,
      })),
    )
  }

  /**
   * Lanza TierValidationFailedError si la configuración resultante (todos los
   * tiers activos para `period` + el tier candidato `incoming`, excluyendo `excludeId`)
   * no es válida.
   */
  private async assertValidWith(
    period: string,
    incoming: {
      level: number
      name: string
      minAmountBOB: string
      maxAmountBOB: string | null | undefined
      rebatePercent: string
    },
    excludeId: string | null,
  ): Promise<void> {
    const others = await this.listActive(period)
    const filtered = excludeId ? others.filter((t) => t.id !== excludeId) : others

    const result = validateTiers([
      ...filtered.map((t) => ({
        id: t.id,
        level: t.level,
        name: t.name,
        minAmountBOB: t.minAmountBOB,
        maxAmountBOB: t.maxAmountBOB,
        rebatePercent: t.rebatePercent,
      })),
      {
        id: 'NEW',
        level: incoming.level,
        name: incoming.name,
        minAmountBOB: incoming.minAmountBOB,
        maxAmountBOB: incoming.maxAmountBOB ?? null,
        rebatePercent: incoming.rebatePercent,
      },
    ])

    if (!result.valid) {
      const errors = result.conflicts.filter((c) => c.severity === 'error')
      throw new TierValidationFailedError(errors)
    }
  }

  private toDTO(tier: {
    id: string
    level: number
    name: string
    minAmountBOB: { toString: () => string }
    maxAmountBOB: { toString: () => string } | null
    rebatePercent: { toString: () => string }
    active: boolean
    validFromPeriod: string
    validToPeriod: string | null
  }): CashbackTierDTO {
    return {
      id: tier.id,
      level: tier.level,
      name: tier.name,
      minAmountBOB: tier.minAmountBOB.toString(),
      maxAmountBOB: tier.maxAmountBOB?.toString() ?? null,
      rebatePercent: tier.rebatePercent.toString(),
      active: tier.active,
      validFromPeriod: tier.validFromPeriod,
      validToPeriod: tier.validToPeriod,
    }
  }
}
