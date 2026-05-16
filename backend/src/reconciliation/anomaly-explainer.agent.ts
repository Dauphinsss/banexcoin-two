import { createHash } from 'node:crypto'
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

const MODEL = 'gemini-2.5-flash'
const MAX_TOKENS = 300

const SYSTEM_PROMPT = `Eres un analista de conciliación financiera de Banexcoin Bolivia.
Recibes un resumen agregado de anomalías detectadas al cruzar pagos QR contra el
extracto bancario. Tu tarea es proponer hipótesis plausibles sobre su origen.

Reglas:
- Responde en español, en 2 o 3 oraciones, sin listas ni encabezados.
- Sé concreto: menciona patrones temporales o de monto si los datos los sugieren.
- No inventes cifras que no estén en el resumen.
- Cierra con una recomendación operativa breve.`

const TYPE_LABELS: Record<string, string> = {
  NO_EXTRACT: 'sin contraparte en el extracto bancario',
  NO_QR: 'presentes en el extracto pero sin pago QR asociado',
  AMOUNT_MISMATCH: 'con monto distinto entre QR y extracto',
  INVALID_RATE: 'con tipo de cambio inválido',
}

@Injectable()
export class AnomalyExplainerAgent {
  private readonly logger = new Logger(AnomalyExplainerAgent.name)
  private readonly cache = new Map<string, string>()
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

    if (anomalies.length === 0) {
      return {
        available: true,
        cached: false,
        explanation: 'No se detectaron anomalías en este upload; la conciliación cuadra.',
      }
    }

    const client = await this.getClient()
    if (!client) {
      return {
        available: false,
        cached: false,
        explanation:
          'La explicación con IA no está disponible: falta configurar GEMINI_API_KEY.',
      }
    }

    const cacheKey = createHash('sha256').update(summary).digest('hex')
    const hit = this.cache.get(cacheKey)
    if (hit) {
      return { available: true, cached: true, explanation: hit }
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

      this.cache.set(cacheKey, text)
      return { available: true, cached: false, explanation: text }
    } catch (error) {
      this.logger.error(
        `Fallo al llamar a Gemini: ${error instanceof Error ? error.message : String(error)}`,
      )
      return {
        available: false,
        cached: false,
        explanation:
          'No se pudo generar la explicación con IA en este momento. Intenta de nuevo más tarde.',
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

    const lines: string[] = [
      `Total de anomalías: ${anomalies.length}.`,
      'Conteo por tipo:',
    ]
    for (const [type, list] of byType) {
      lines.push(`- ${list.length} ${TYPE_LABELS[type] ?? type}.`)
    }

    const examples = anomalies.slice(0, 5).map((a) => {
      const parts = [`tx ${a.transactionId}`, TYPE_LABELS[a.type] ?? a.type]
      if (a.deltaBOB) parts.push(`delta Bs ${a.deltaBOB}`)
      return `  · ${parts.join(', ')}`
    })
    if (examples.length > 0) {
      lines.push('Ejemplos:')
      lines.push(...examples)
    }

    return lines.join('\n')
  }
}
