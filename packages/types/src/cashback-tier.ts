import type { DecimalString } from './money.js'

export interface CashbackTierDTO {
  id: string
  level: number
  name: string
  minAmountBOB: DecimalString
  maxAmountBOB: DecimalString | null
  rebatePercent: DecimalString
  active: boolean
  validFromPeriod: string
  validToPeriod: string | null
}

export interface TierValidationResult {
  valid: boolean
  conflicts: Array<{
    type: 'OVERLAP' | 'GAP' | 'INVERTED_RANGE' | 'NEGATIVE_PERCENT'
    tierIds: string[]
    message: string
  }>
}
