import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import type { AnomalyDTO } from '@banex/types'
import { AnomalyExplainerAgent } from './anomaly-explainer.agent'
import type { ReconciliationService } from './reconciliation.service'

const makeAnomaly = (overrides?: Partial<AnomalyDTO>): AnomalyDTO => ({
  id: 'anomaly-1',
  uploadId: 'upload-1',
  transactionId: 'tx-sensitive',
  type: 'AMOUNT_MISMATCH',
  qrAmountBOB: '100.00',
  extractAmountBOB: '99.50',
  deltaBOB: '0.50',
  resolved: false,
  resolvedAt: null,
  resolvedNote: null,
  ...overrides,
})

const makeAgent = (
  anomalies: AnomalyDTO[],
  config = { get: vi.fn(() => undefined) } as unknown as ConfigService,
): AnomalyExplainerAgent => {
  const reconciliation = {
    list: vi.fn(async () => anomalies),
  } as unknown as ReconciliationService

  return new AnomalyExplainerAgent(config, reconciliation)
}

describe('AnomalyExplainerAgent', () => {
  it('devuelve respuesta local cuando no hay anomalías', async () => {
    const agent = makeAgent([])

    await expect(agent.explain('upload-1')).resolves.toEqual({
      available: true,
      cached: false,
      explanation: 'No se detectaron anomalías en este upload; la conciliación cuadra.',
    })
  })

  it('devuelve diagnóstico local útil si falta CEREBRAS_API_KEY', async () => {
    const agent = makeAgent([makeAnomaly()])

    const result = await agent.explain('upload-1')

    expect(result.available).toBe(false)
    expect(result.cached).toBe(false)
    expect(result.explanation).toContain('Resumen automático')
    expect(result.explanation).toContain('monto distinto')
    expect(result.explanation).toContain('delta promedio')
  })

  it('usa diagnóstico local para muestras pequeñas aunque exista CEREBRAS_API_KEY', async () => {
    const config = { get: vi.fn(() => 'fake-key') } as unknown as ConfigService
    const agent = makeAgent([makeAnomaly()], config)

    const result = await agent.explain('upload-1')

    expect(result.available).toBe(false)
    expect(result.explanation).toContain('Resumen automático')
    expect((config.get as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('construye un resumen agregado sin exponer ids de transacción', () => {
    const agent = makeAgent([
      makeAnomaly(),
      makeAnomaly({
        id: 'anomaly-2',
        transactionId: 'tx-other-sensitive',
        type: 'NO_EXTRACT',
        qrAmountBOB: '25.00',
        extractAmountBOB: null,
        deltaBOB: null,
        resolved: true,
      }),
    ])

    const summary = (
      agent as unknown as { buildSummary(anomalies: AnomalyDTO[]): string }
    ).buildSummary([
      makeAnomaly(),
      makeAnomaly({
        id: 'anomaly-2',
        transactionId: 'tx-other-sensitive',
        type: 'NO_EXTRACT',
        qrAmountBOB: '25.00',
        extractAmountBOB: null,
        deltaBOB: null,
        resolved: true,
      }),
    ])

    expect(summary).toContain('Total de anomalías: 2.')
    expect(summary).toContain('1 resueltas y 1 pendientes')
    expect(summary).toContain('Monto QR sin extracto: Bs 25.00.')
    expect(summary).not.toContain('tx-sensitive')
    expect(summary).not.toContain('tx-other-sensitive')
  })
})
