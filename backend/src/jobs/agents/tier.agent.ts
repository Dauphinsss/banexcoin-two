import { Inject, Injectable } from '@nestjs/common'
import { calculateRebates, type RebateResult, type TierEngineTier, type TierEngineTransaction } from '@banex/utils'
import type { QRTransactionRaw } from '../../parser/parser.types'
import { TiersService } from '../../tiers/tiers.service'

@Injectable()
export class TierAgent {
  constructor(@Inject(TiersService) private readonly tiers: TiersService) {}

  async run(
    period: string,
    rows: QRTransactionRaw[],
  ): Promise<RebateResult[]> {
    const activeTiers = await this.tiers.listActive(period)
    if (activeTiers.length === 0) {
      throw new Error(`No hay tiers activos para el periodo ${period}.`)
    }

    const transactions: TierEngineTransaction[] = rows.map((row) => ({
      userId: row.accountNumber,
      amountBOB: row.amountBOB,
      amountUSDT: row.amountUSDT,
      exchangeRate: row.exchangeRate,
    }))

    const tiers: TierEngineTier[] = activeTiers.map((tier) => ({
      id: tier.level,
      name: tier.name,
      minAmountBOB: tier.minAmountBOB,
      maxAmountBOB: tier.maxAmountBOB,
      rebatePercent: tier.rebatePercent,
    }))

    return calculateRebates({ transactions, tiers })
  }
}
