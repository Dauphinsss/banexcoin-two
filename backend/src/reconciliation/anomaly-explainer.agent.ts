import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AnomalyDTO } from '@banex/types'
import { ReconciliationService } from './reconciliation.service'

type GoogleGenAIClient = InstanceType<
  typeof import('@google/genai', { with: { 'resolution-mode': 'import' } }).GoogleGenAI
>

export interface AnomalyExplanation {
  available: boolean
  cached: boolean
  explanation: string
}

const MODEL = 'gemini-3-flash-preview'
const MAX_TOKENS = 300

const SYSTEM_PROMPT = `Eres un analista de conciliación financiera de Banexcoin Bolivia.
Recibes un resumen agregado de anomalías detectadas al cruzar pagos QR contra el
extracto bancario. Tu tarea es resumir el patrón observado y recomendar la
siguiente acción operativa.

Reglas:
- Responde en español, exactamente en 2 oraciones, sin listas ni encabezados.
- No inventes causas, horarios, lotes, bancos, procesos internos ni problemas externos.
- Si el resumen dice que no hay fechas ni causas externas, no menciones contexto temporal.
- Sé concreto: menciona patrones de monto solo si los datos los sugieren.
- No inventes cifras que no estén en el resumen.
- Cierra con una recomendación operativa breve.`

const TYPE_LABELS: Record<string, string> = {
  NO_EXTRACT: 'sin contraparte en el extracto bancario',
  NO_QR: 'presentes en el extracto pero sin pago QR asociado',
  AMOUNT_MISMATCH: 'con monto distinto entre QR y extracto',
  INVALID_RATE: 'con tipo de cambio inválido',
}

const TYPE_ACTIONS: Record<string, string> = {
  NO_EXTRACT: 'validar si esos pagos QR quedaron pendientes de asiento en el extracto antes de ejecutar reintegros.',
  NO_QR: 'confirmar si esos movimientos del extracto corresponden a cobros, transferencias u otra operación fuera de Pago QR.',
  AMOUNT_MISMATCH: 'revisar redondeos, reversos parciales o ajustes manuales en las transacciones con diferencia de monto.',
  INVALID_RATE: 'corregir o excluir las filas con tipo de cambio inválido antes de recalcular reintegros.',
}

@Injectable()
export class AnomalyExplainerAgent {
  private readonly logger = new Logger(AnomalyExplainerAgent.name)
  private clientPromise: Promise<GoogleGenAIClient | null> | null = null

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
  ) {}

  /**
   * @google/genai es ESM-only y el backend compila a CommonJS, por eso el
   * cliente se carga con import() dinámico de forma perezosa y se memoiza.
   */
  private getClient(): Promise<GoogleGenAIClient | null> {
    if (this.clientPromise) return this.clientPromise

    const apiKey = this.config.get<string>('GEMINI_API_KEY')
    if (!apiKey) {
      this.clientPromise = Promise.resolve(null)
      return this.clientPromise
    }

    this.clientPromise = import('@google/genai')
      .then((mod) => new mod.GoogleGenAI({ apiKey }))
      .catch((error) => {
        this.logger.error(
          `No se pudo cargar @google/genai: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      })
    return this.clientPromise
  }

  async explain(uploadId: string): Promise<AnomalyExplanation> {
    const anomalies = await this.reconciliation.list(uploadId)
    const summary = this.buildSummary(anomalies)
    const fallback = this.buildDeterministicExplanation(anomalies)

    if (anomalies.length === 0) {
      return {
        available: true,
        cached: false,
        explanation: 'No se detectaron anomalías en este upload; la conciliación cuadra.',
      }
    }

    if (!this.shouldUseModel(anomalies)) {
      return {
        available: false,
        cached: false,
        explanation: fallback,
      }
    }

    const client = await this.getClient()
    if (!client) {
      return {
        available: false,
        cached: false,
        explanation: fallback,
      }
    }

    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: summary,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: MAX_TOKENS,
        },
      })

      const text = (response.text ?? '').trim()
      if (text === '') {
        throw new Error('Respuesta vacía del modelo')
      }

      return { available: true, cached: false, explanation: text }
    } catch (error) {
      this.logger.error(
        `Fallo al llamar a Gemini: ${error instanceof Error ? error.message : String(error)}`,
      )
      return {
        available: false,
        cached: false,
        explanation: fallback,
      }
    }
  }

  private buildSummary(anomalies: AnomalyDTO[]): string {
    const byType = new Map<string, AnomalyDTO[]>()
    for (const anomaly of anomalies) {
      const list = byType.get(anomaly.type) ?? []
      list.push(anomaly)
      byType.set(anomaly.type, list)
    }

    const resolvedCount = anomalies.filter((a) => a.resolved).length
    const pendingCount = anomalies.length - resolvedCount
    const lines: string[] = [
      'Datos agregados de conciliación. No hay fechas ni causas externas en este resumen.',
      `Total de anomalías: ${anomalies.length}.`,
      `Estado: ${resolvedCount} resueltas y ${pendingCount} pendientes.`,
      'Conteo por tipo:',
    ]
    for (const [type, list] of byType) {
      const percent = anomalies.length === 0 ? 0 : (list.length / anomalies.length) * 100
      lines.push(`- ${list.length} (${percent.toFixed(1)}%) ${TYPE_LABELS[type] ?? type}.`)
    }

    const deltas = anomalies
      .filter((a) => a.type === 'AMOUNT_MISMATCH' && a.deltaBOB !== null)
      .map((a) => Number(a.deltaBOB))
      .filter(Number.isFinite)

    if (deltas.length > 0) {
      const total = deltas.reduce((sum, value) => sum + value, 0)
      const average = total / deltas.length
      lines.push(
        `Diferencias de monto: delta promedio Bs ${average.toFixed(2)}, ` +
          `mínimo Bs ${Math.min(...deltas).toFixed(2)} y máximo Bs ${Math.max(...deltas).toFixed(2)}.`,
      )
    }

    const qrOnlyBOB = this.sumMoney(
      anomalies.filter((a) => a.type === 'NO_EXTRACT').map((a) => a.qrAmountBOB),
    )
    const extractOnlyBOB = this.sumMoney(
      anomalies.filter((a) => a.type === 'NO_QR').map((a) => a.extractAmountBOB),
    )
    if (qrOnlyBOB > 0) lines.push(`Monto QR sin extracto: Bs ${qrOnlyBOB.toFixed(2)}.`)
    if (extractOnlyBOB > 0) lines.push(`Monto extracto sin QR: Bs ${extractOnlyBOB.toFixed(2)}.`)

    const dominant = this.getDominantType(anomalies)
    if (dominant) {
      lines.push(`Tipo dominante: ${TYPE_LABELS[dominant] ?? dominant}.`)
      lines.push(`Recomendación base: ${TYPE_ACTIONS[dominant] ?? 'revisar la muestra antes de cerrar la conciliación.'}`)
    }

    return lines.join('\n')
  }

  private buildDeterministicExplanation(anomalies: AnomalyDTO[]): string {
    if (anomalies.length === 0) {
      return 'No se detectaron anomalías en este upload; la conciliación cuadra.'
    }

    const dominant = this.getDominantType(anomalies)
    const label = dominant ? TYPE_LABELS[dominant] ?? dominant : 'sin patrón dominante claro'
    const dominantCount = dominant
      ? anomalies.filter((a) => a.type === dominant).length
      : 0
    const pendingCount = anomalies.filter((a) => !a.resolved).length
    const deltas = anomalies
      .filter((a) => a.type === 'AMOUNT_MISMATCH' && a.deltaBOB !== null)
      .map((a) => Number(a.deltaBOB))
      .filter(Number.isFinite)

    const amountContext = deltas.length > 0
      ? ` En diferencias de monto, el delta promedio es Bs ${
          (deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2)
        }, con máximo Bs ${Math.max(...deltas).toFixed(2)}.`
      : ''

    const action = dominant
      ? TYPE_ACTIONS[dominant]
      : 'revisar primero los casos pendientes de mayor monto y luego cerrar los resueltos.'

    return `Resumen automático: hay ${anomalies.length} anomalías, ${pendingCount} pendientes; el patrón principal es ${label} (${dominantCount} casos).${amountContext} Recomendación: ${action}`
  }

  private getDominantType(anomalies: AnomalyDTO[]): string | null {
    const counts = new Map<string, number>()
    for (const anomaly of anomalies) {
      counts.set(anomaly.type, (counts.get(anomaly.type) ?? 0) + 1)
    }

    let dominant: string | null = null
    let max = 0
    for (const [type, count] of counts) {
      if (count > max) {
        dominant = type
        max = count
      }
    }
    return dominant
  }

  private shouldUseModel(anomalies: AnomalyDTO[]): boolean {
    if (anomalies.length < 3) return false

    const dominant = this.getDominantType(anomalies)
    if (!dominant) return false

    const dominantCount = anomalies.filter((a) => a.type === dominant).length
    return dominantCount >= 3
  }

  private sumMoney(values: Array<string | null>): number {
    return values.reduce((sum, value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? sum + parsed : sum
    }, 0)
  }
}
