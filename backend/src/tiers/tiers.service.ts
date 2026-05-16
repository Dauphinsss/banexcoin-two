import { Injectable } from '@nestjs/common'
import type { CashbackTierDTO } from '@banex/types'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TiersService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(period?: string): Promise<CashbackTierDTO[]> {
    const tiers = await this.prisma.cashbackTier.findMany({
      where: {
        active: true,
        ...(period
          ? {
              validFromPeriod: { lte: period },
              OR: [
                { validToPeriod: null },
                { validToPeriod: { gte: period } },
              ],
            }
          : {}),
      },
      orderBy: [
        { level: 'asc' },
        { minAmountBOB: 'asc' },
      ],
    })

    return tiers.map((tier) => ({
      id: tier.id,
      level: tier.level,
      name: tier.name,
      minAmountBOB: tier.minAmountBOB.toString(),
      maxAmountBOB: tier.maxAmountBOB?.toString() ?? null,
      rebatePercent: tier.rebatePercent.toString(),
      active: tier.active,
      validFromPeriod: tier.validFromPeriod,
      validToPeriod: tier.validToPeriod,
    }))
  }
}
