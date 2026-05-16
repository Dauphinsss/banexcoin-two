import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { D } from '@banex/utils'
import type { AnomalyType } from '@banex/types'
import type { ParseResult } from '../../parser/parser.types'

export interface ReconciliationFinding {
  transactionId: string
  type: AnomalyType
  qrAmountBOB: string | null
  extractAmountBOB: string | null
  deltaBOB: string | null
}

@Injectable()
export class ReconcileAgent {
  private readonly toleranceBOB: ReturnType<typeof D>

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.toleranceBOB = D(config.get<string>('RECONCILE_TOLERANCE_BOB') ?? '0.01')
  }

  run(parsed: Pick<ParseResult, 'qrRows' | 'extractRows'>): ReconciliationFinding[] {
    const qrById = new Map(parsed.qrRows.map((row) => [row.transactionId, row]))
    const extractById = new Map(parsed.extractRows.map((row) => [row.transactionId, row]))
    const findings: ReconciliationFinding[] = []

    for (const [transactionId, qrRow] of qrById) {
      const extractRow = extractById.get(transactionId)

      if (!extractRow) {
        findings.push({
          transactionId,
          type: 'NO_EXTRACT',
          qrAmountBOB: qrRow.amountBOB,
          extractAmountBOB: null,
          deltaBOB: null,
        })
        continue
      }

      const delta = D(qrRow.amountBOB).minus(D(extractRow.amountBOB))
      if (delta.abs().greaterThan(this.toleranceBOB)) {
        findings.push({
          transactionId,
          type: 'AMOUNT_MISMATCH',
          qrAmountBOB: qrRow.amountBOB,
          extractAmountBOB: extractRow.amountBOB,
          deltaBOB: delta.toFixed(2),
        })
      }
    }

    for (const [transactionId, extractRow] of extractById) {
      if (!qrById.has(transactionId)) {
        findings.push({
          transactionId,
          type: 'NO_QR',
          qrAmountBOB: null,
          extractAmountBOB: extractRow.amountBOB,
          deltaBOB: null,
        })
      }
    }

    return findings.sort((a, b) => a.transactionId.localeCompare(b.transactionId))
  }
}
