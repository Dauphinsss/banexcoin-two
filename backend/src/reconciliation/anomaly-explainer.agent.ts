import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AnomalyDTO } from '@banex/types'
import { ReconciliationService } from './reconciliation.service'

interface CerebrasMessage {
  role: 'system' | 'user'
  content: string
}

interface CerebrasCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: unknown
    }
  }>
}

interface CerebrasCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

interface CerebrasClient {
  chat: {
    completions: {
      create(input: {
        messages: CerebrasMessage[]
        model: string
        max_completion_tokens: number
        temperature: number
        top_p: number
        stream: false
      }): Promise<CerebrasCompletionResponse>
      create(input: {
        messages: CerebrasMessage[]
        model: string
        max_completion_tokens: number
        temperature: number
        top_p: number
        stream: true
      }): Promise<AsyncIterable<CerebrasCompletionChunk>>
    }
  }
}

export interface AnomalyExplanation {
  available: boolean
  cached: boolean
  explanation: string
}

interface AnomalyExplanationStream {
  chunks: AsyncIterable<string>
}

interface PreparedStaticExplanation {
  kind: 'static'
  available: boolean
  cached: boolean
  explanation: string
}

interface PreparedModelExplanation {
  kind: 'model'
  available: boolean
  cached: boolean
  client: CerebrasClient
  fallback: string
  messages: CerebrasMessage[]
}

type PreparedExplanation = PreparedStaticExplanation | PreparedModelExplanation

const MODEL = 'qwen-3-235b-a22b-instruct-2507'
const MAX_TOKENS = 300
const TEMPERATURE = 0.2
const TOP_P = 1

const SYSTEM_PROMPT = `Eres un analista de conciliación financiera de Banexcoin Bolivia.
Recibes un resumen agregado de anomalías detectadas al cruzar pagos QR contra el
extracto bancario. Tu tarea es resumir el patrón observado y recomendar la
siguiente acción operativa.

Reglas:
- Responde en español con lenguaje simple, amable y fácil de entender.
- Usa palabras simples, cercanas y fáciles de entender para un usuario operativo no técnico.
- Suena útil y tranquilo; evita tono robótico, demasiado formal o muy técnico.
- Responde en texto plano, sin markdown, sin viñetas, sin numeración, sin asteriscos y sin encabezados.
- No uses emojis, iconos ni símbolos decorativos.
- Si el caso es simple, puedes separarlo en ideas generales cortas dentro del mismo texto plano.
- No inventes causas, horarios, lotes, bancos, procesos internos ni problemas externos.
- Si el resumen dice que no hay fechas ni causas externas, no menciones contexto temporal.
- Sé concreto: menciona patrones de monto solo si los datos los sugieren.
- No inventes cifras que no estén en el resumen.
- Si usas una recomendación, que sea corta y práctica.`

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
  private clientPromise: Promise<CerebrasClient | null> | null = null

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
  ) {}

  /**
   * El SDK de Cerebras se carga bajo demanda para mantener el arranque del
   * backend simple y evitar depender de imports ESM en caliente.
   */
  private getClient(): Promise<CerebrasClient | null> {
    if (this.clientPromise) return this.clientPromise

    const apiKey = this.config.get<string>('CEREBRAS_API_KEY')
    if (!apiKey) {
      this.clientPromise = Promise.resolve(null)
      return this.clientPromise
    }

    this.clientPromise = import('@cerebras/cerebras_cloud_sdk')
      .then((mod) => new mod.default({ apiKey }) as CerebrasClient)
      .catch((error) => {
        this.logger.error(
          `No se pudo cargar el SDK de Cerebras: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      })
    return this.clientPromise
  }

  async explain(uploadId: string): Promise<AnomalyExplanation> {
    const prepared = await this.prepareExplanation(uploadId)
    if (prepared.kind === 'static') {
      return {
        available: prepared.available,
        cached: prepared.cached,
        explanation: prepared.explanation,
      }
    }

    try {
      const response = await prepared.client.chat.completions.create({
        messages: prepared.messages,
        model: MODEL,
        max_completion_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        top_p: TOP_P,
        stream: false,
      })

      const text = this.extractText(response.choices?.[0]?.message?.content).trim()
      if (text === '') {
        throw new Error('Respuesta vacía del modelo')
      }

      return { available: prepared.available, cached: prepared.cached, explanation: text }
    } catch (error) {
      this.logger.error(
        `Fallo al llamar a Cerebras: ${error instanceof Error ? error.message : String(error)}`,
      )
      return {
        available: false,
        cached: prepared.cached,
        explanation: prepared.fallback,
      }
    }
  }

  async explainStream(uploadId: string): Promise<AnomalyExplanationStream> {
    const prepared = await this.prepareExplanation(uploadId)
    if (prepared.kind === 'static') {
      return { chunks: this.streamText(prepared.explanation) }
    }

    return {
      chunks: this.streamModel(prepared),
    }
  }

  private async prepareExplanation(uploadId: string): Promise<PreparedExplanation> {
    const anomalies = await this.reconciliation.list(uploadId)
    const fallback = this.buildDeterministicExplanation(anomalies)

    if (anomalies.length === 0) {
      return {
        kind: 'static',
        available: true,
        cached: false,
        explanation: 'No se detectaron anomalías en este upload; la conciliación cuadra.',
      }
    }

    if (!this.shouldUseModel(anomalies)) {
      return {
        kind: 'static',
        available: false,
        cached: false,
        explanation: fallback,
      }
    }

    const client = await this.getClient()
    if (!client) {
      return {
        kind: 'static',
        available: false,
        cached: false,
        explanation: fallback,
      }
    }

    return {
      kind: 'model',
      available: true,
      cached: false,
      client,
      fallback,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: this.buildSummary(anomalies) },
      ],
    }
  }

  private async *streamModel(prepared: PreparedModelExplanation): AsyncGenerator<string> {
    let emitted = false

    try {
      const stream = await prepared.client.chat.completions.create({
        messages: prepared.messages,
        model: MODEL,
        max_completion_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        top_p: TOP_P,
        stream: true,
      })

      for await (const chunk of stream) {
        const text = this.extractText(chunk.choices?.[0]?.delta?.content)
        if (text === '') continue

        emitted = true
        yield text
      }

      if (!emitted) {
        throw new Error('Respuesta vacía del modelo en streaming')
      }
    } catch (error) {
      this.logger.error(
        `Fallo al transmitir desde Cerebras: ${error instanceof Error ? error.message : String(error)}`,
      )

      if (!emitted) {
        yield* this.streamText(prepared.fallback)
      }
    }
  }

  private async *streamText(text: string): AsyncGenerator<string> {
    yield text
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

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''

    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (isRecord(item) && typeof item.text === 'string') return item.text
        return ''
      })
      .join('')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
