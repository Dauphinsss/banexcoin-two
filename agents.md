# BanexReintegra — Agents

Mapa de todos los agentes del sistema: workers de BullMQ, gateway de eventos y el agente de IA opcional para explicación de anomalías.

---

## Mapa general

```
                        ┌─────────────────────────────────┐
                        │           NestJS API             │
                        │                                  │
  HTTP POST /uploads ──►│  UploadsController               │
                        │       │                          │
                        │       ▼                          │
                        │  UploadsService                  │
                        │   ├─ valida MIME                 │
                        │   ├─ calcula SHA-256             │
                        │   ├─ guarda Upload{PENDING}      │
                        │   └─ encola job ─────────────────┼──► BullMQ (Redis)
                        │                                  │          │
                        │  EventsGateway (Socket.IO) ◄─────┼──────────┤
                        │       │                          │          │
                        └───────┼──────────────────────────┘          │
                                │                                      │
                         WS emit a cliente                             ▼
                                                          ┌─────────────────────┐
                                                          │  ProcessUploadAgent │
                                                          │  (BullMQ Worker)    │
                                                          │                     │
                                                          │  1. ParseAgent      │
                                                          │  2. TierAgent       │
                                                          │  3. ReconcileAgent  │
                                                          │  4. ReportAgent     │
                                                          └─────────────────────┘
```

---

## Agentes de procesamiento (BullMQ Workers)

### ProcessUploadAgent — orquestador

**Cola:** `uploads`
**Archivo:** `apps/api/src/jobs/process-upload.job.ts`

Recibe el `uploadId`, orquesta los agentes secundarios en secuencia y emite eventos de progreso.

```typescript
@Processor('uploads')
export class ProcessUploadAgent extends WorkerHost {
  async process(job: Job<{ uploadId: string }>) {
    const { uploadId } = job.data

    await this.emit(job, 5, 'Leyendo archivo...')
    const rows = await this.parseAgent.run(uploadId)

    await this.emit(job, 30, 'Calculando reintegros...')
    const rebates = await this.tierAgent.run(uploadId, rows)

    await this.emit(job, 65, 'Conciliando con extracto bancario...')
    const anomalies = await this.reconcileAgent.run(uploadId, rows)

    await this.emit(job, 90, 'Guardando resultados...')
    await this.persistenceAgent.run(uploadId, rebates, anomalies)

    await this.emit(job, 100, 'Listo')
    await this.eventsGateway.emitDone(uploadId, rebates.length, anomalies.length)
  }

  private emit(job: Job, percent: number, message: string) {
    job.updateProgress(percent)
    return this.eventsGateway.emitProgress(job.id, percent, message)
  }
}
```

**Estados que emite por WebSocket:**

| % | Mensaje |
|---|---|
| 5 | "Leyendo archivo..." |
| 30 | "Calculando reintegros..." |
| 65 | "Conciliando con extracto bancario..." |
| 90 | "Guardando resultados..." |
| 100 | "Listo" |

---

### ParseAgent

**Responsabilidad única:** convertir las hojas del Excel en estructuras tipadas. No toca la base de datos.

**Archivo:** `apps/api/src/jobs/agents/parse.agent.ts`

**Hojas que procesa:**

| Hoja | Propósito | Columnas clave |
|---|---|---|
| `Pago QR` | Transacciones de pago | `Creado por`, `Número de Cuenta`, `Monto intercambio`, `Monto Pagado`, `Precio`, `Transacción Id` |
| `EXTRACTO DE PAGOS` | Extracto bancario para conciliación | `Transacción Id`, `Monto`, `Fecha` |
| `Cobro QR` | Cobros de comercios (info extra) | — |
| `Transfers` | Formato BanexTransfer (referencia) | — |

**Contrato:**

```typescript
interface ParseAgent {
  run(uploadId: string): Promise<ParseResult>
}

interface ParseResult {
  qrRows: QRTransactionRaw[]
  extractRows: ExtractRowRaw[]
  period: string              // "2025-05" inferido de las fechas
  parseErrors: ParseError[]   // filas que no pudieron parsearse
}
```

**Reglas de validación que aplica:**
- Header de `Pago QR` debe tener exactamente las columnas esperadas (falla el job si no).
- `Transacción Id` no puede ser vacío ni duplicado dentro del mismo archivo.
- `Monto intercambio` y `Monto Pagado` deben ser numéricos positivos.
- Filas con errores se coleccionan en `parseErrors` y se guardan; no abortan el job.

---

### TierAgent

**Responsabilidad única:** aplicar el `tier-engine` a las filas parseadas y producir `RebateResult[]`. No toca la base de datos directamente.

**Archivo:** `apps/api/src/jobs/agents/tier.agent.ts`

```typescript
interface TierAgent {
  run(uploadId: string, rows: QRTransactionRaw[]): Promise<RebateResult[]>
}
```

Internamente:
1. Carga los `CashbackTier[]` activos para el período desde Prisma.
2. Llama a `calculateRebates()` de `packages/utils` con los datos normalizados.
3. Devuelve los resultados sin persistir (eso lo hace `PersistenceAgent`).

---

### ReconcileAgent

**Responsabilidad única:** cruzar `qrRows` con `extractRows` y clasificar anomalías.

**Archivo:** `apps/api/src/jobs/agents/reconcile.agent.ts`

```typescript
type AnomalyType = 'NO_EXTRACT' | 'NO_QR' | 'AMOUNT_MISMATCH'

interface Anomaly {
  transactionId: string
  type: AnomalyType
  qrAmount?: string
  extractAmount?: string
  delta?: string
}

interface ReconcileAgent {
  run(uploadId: string, rows: ParseResult): Promise<Anomaly[]>
}
```

**Algoritmo:**

```
SET qrIds   = { txId → amountBOB }  (del ParseResult)
SET extIds  = { txId → amount }     (del ParseResult)

Para cada id en qrIds:
  Si no está en extIds     → Anomaly{ type: NO_EXTRACT }
  Si está y monto difiere  → Anomaly{ type: AMOUNT_MISMATCH, delta }

Para cada id en extIds que no esté en qrIds:
  → Anomaly{ type: NO_QR }
```

Tolerancia de diferencia configurable vía variable de entorno `RECONCILE_TOLERANCE_BOB` (default: `0.01`).

---

### PersistenceAgent

**Responsabilidad única:** escribir en Postgres los resultados de los otros agentes en una sola transacción.

**Archivo:** `apps/api/src/jobs/agents/persistence.agent.ts`

```typescript
interface PersistenceAgent {
  run(
    uploadId: string,
    rebates: RebateResult[],
    anomalies: Anomaly[],
    parseErrors: ParseError[]
  ): Promise<void>
}
```

Usa `prisma.$transaction([...])` para garantizar que o todo se guarda o nada. Si falla, el job queda en estado `FAILED` y BullMQ reintenta automáticamente.

---

### ReportAgent (bajo demanda, no en cola)

**Responsabilidad única:** generar los archivos de salida desde los datos ya persistidos.

**Archivo:** `apps/api/src/reports/report.agent.ts`

Dos generadores:

**A) Excel de reintegros** (`exceljs`)
- Hoja 1 "Reintegros": una fila por `MonthlyRebate` con todas las columnas
- Hoja 2 "Resumen por nivel": agregados (count, total USDT, total BOB, % del total) por nivel
- Hoja 3 "Anomalías": listado con tipo, `transactionId` y delta
- Hoja 4 "Errores de parseo": filas que no pudieron leerse

**B) Archivo BanexTransfer** (CSV o Excel según especificación de Banexcoin)
```
Nro | Cuenta Origen | Cuenta Destino | Monto USDT | Monto BOB | T/C promedio | Referencia
```

Ambos generadores son idempotentes: siempre leen desde `MonthlyRebate` y nunca modifican estado.

---

## EventsGateway (Socket.IO)

**Archivo:** `apps/api/src/events/events.gateway.ts`

```typescript
@WebSocketGateway({ namespace: '/jobs', cors: true })
export class EventsGateway {
  @WebSocketServer() server: Server

  emitProgress(jobId: string, percent: number, message: string) {
    this.server.emit('job:progress', { jobId, percent, message })
  }

  emitDone(uploadId: string, rebateCount: number, anomalyCount: number) {
    this.server.emit('job:done', { uploadId, rebateCount, anomalyCount })
  }

  emitFailed(jobId: string, error: string) {
    this.server.emit('job:failed', { jobId, error })
  }
}
```

El island React `JobProgress.tsx` (Astro `client:load`) escucha en `src/lib/socket.ts` y actualiza el estado local cuando recibe `job:done`. Como Astro no tiene un proveedor de TanStack Query global, cada island que necesita datos frescos llama a `fetch` directamente o usa el hook `useQuery` si tiene el `QueryClientProvider` montado localmente.

---

## Agente de IA opcional — AnomalyExplainerAgent

**Cuándo usarlo:** si hay tiempo en el Día 3 y se quiere impresionar en el pitch.

**Qué hace:** dado un conjunto de anomalías, llama a la API de Claude para generar una explicación en lenguaje natural del patrón detectado.

**Archivo:** `apps/api/src/reconciliation/anomaly-explainer.agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

export class AnomalyExplainerAgent {
  private client = new Anthropic()

  async explain(anomalies: Anomaly[]): Promise<string> {
    const summary = this.buildSummary(anomalies)

    const message = await this.client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Eres un analista financiero de Banexcoin. 
Analiza estas anomalías de conciliación y explica en 2-3 oraciones qué patrón observas y qué podría haberlo causado.
Responde en español, tono profesional, sin tecnicismos.

Anomalías:
${summary}`
      }]
    })

    return (message.content[0] as { text: string }).text
  }

  private buildSummary(anomalies: Anomaly[]): string {
    const byType = {
      NO_EXTRACT: anomalies.filter(a => a.type === 'NO_EXTRACT').length,
      NO_QR: anomalies.filter(a => a.type === 'NO_QR').length,
      AMOUNT_MISMATCH: anomalies.filter(a => a.type === 'AMOUNT_MISMATCH').length,
    }
    return JSON.stringify(byType, null, 2)
  }
}
```

**Dónde aparece en la UI:** botón "Explicar con IA" en el panel de anomalías. Resultado en un tooltip o modal.

---

## Configuración de BullMQ

```typescript
// apps/api/src/jobs/bull.config.ts
export const bullConfig = {
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
}
```

**Reintentos:** 3 intentos con backoff exponencial (2s, 4s, 8s). Si los 3 fallan, el job queda en `FAILED` y se notifica al cliente.

**Concurrencia:** 1 job a la vez por defecto (los Excel de 5.000 filas son rápidos, <2s, no vale la pena paralelizar y arriesgarse a deadlocks en Postgres).

---

## Resumen de agentes

| Agente | Tipo | Disparo | Persiste? |
|---|---|---|---|
| `ProcessUploadAgent` | BullMQ Worker | HTTP POST /uploads | No (orquesta) |
| `ParseAgent` | Servicio interno | Llamado por ProcessUpload | No |
| `TierAgent` | Servicio interno | Llamado por ProcessUpload | No |
| `ReconcileAgent` | Servicio interno | Llamado por ProcessUpload | No |
| `PersistenceAgent` | Servicio interno | Llamado por ProcessUpload | **Sí** |
| `ReportAgent` | Servicio interno | HTTP GET /uploads/:id/report | No |
| `EventsGateway` | WebSocket | Llamado por ProcessUpload | No |
| `AnomalyExplainerAgent` | IA (Claude API) | HTTP GET /reconciliation/explain | No |
