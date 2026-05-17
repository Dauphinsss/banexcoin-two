import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OpenAI } from 'openai'
import type { AnomalyDTO } from '@banex/types'
import { ReconciliationService } from './reconciliation.service'

export interface AnomalyExplanation {
  available: boolean
  cached: boolean
  explanation: string
}

const MODEL = 'meta/llama-3.1-70b-instruct'
const MAX_TOKENS = 300

const SYSTEM_PROMPT = `Eres un analista de conciliación financiera senior de Banexcoin Bolivia.
Recibes un resumen agregado de anomalías detectadas al cruzar pagos QR contra el extracto bancario.
Tu objetivo es:
1. Identificar el patrón dominante de anomalías
2. Cuantificar el impacto financiero
3. Recomendar acciones operativas específicas y priorizadas

CONTEXTO BANCARIO:
- Las reconciliaciones requieren precisión exacta
- Los errores de monto pueden indicar problemas de procesamiento o fraude
- Las transacciones faltantes sugieren retrasos en asiento o movimientos externos
- El análisis debe ser profesional, datos-driven y accionable

FORMATO DE RESPUESTA:
- Responde EXACTAMENTE en 2-3 oraciones, en español
- Estructura: [Patrón observado + Cuantificación] → [Recomendación operativa con prioridad]
- No inventes datos que no estén en el resumen
- Sé concreto: solo menciona montos, fechas y procesos si están explícitamente en los datos
- La recomendación debe ser una acción específica que el usuario pueda ejecutar inmediatamente

TONO:
- Profesional, como un analista de datos bancarios
- Directo y sin ambigüedades
- Evita explicaciones innecesarias`

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
  private client: OpenAI | null | undefined

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
  ) {}

  /**
   * Inicializa el cliente de OpenAI para conectar con Nvidia Llama via NVIDIA API
   * Se carga de forma perezosa solo cuando se necesita
   */
  private getClient(): OpenAI | null {
    if (this.client !== undefined) return this.client ?? null

    const apiKey = this.config.get<string>('NVIDIA_API_KEY')
    if (!apiKey) {
      this.client = null
      this.logger.warn('NVIDIA_API_KEY no está configurada')
      return null
    }

    try {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      })
      this.logger.log('Cliente de Nvidia Llama inicializado correctamente')
      return this.client
    } catch (error) {
      this.logger.error(
        `Error inicializando cliente Nvidia: ${error instanceof Error ? error.message : String(error)}`,
      )
      this.client = null
      return null
    }
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

    const client = this.getClient()
    if (!client) {
      this.logger.warn('Cliente de Nvidia no está disponible, usando explicación determinística')
      return {
        available: false,
        cached: false,
        explanation: fallback,
      }
    }

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Analiza las siguientes anomalías de conciliación:\n\n${summary}`,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.3, // Más determinístico para análisis financiero
      })

      const text = (response.choices[0]?.message?.content ?? '').trim()
      if (text === '') {
        throw new Error('Respuesta vacía del modelo')
      }

      this.logger.debug(`Explicación de IA generada para upload ${uploadId}`)
      return { available: true, cached: false, explanation: text }
    } catch (error) {
      this.logger.error(
        `Fallo al llamar a Nvidia Llama: ${error instanceof Error ? error.message : String(error)}`,
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
