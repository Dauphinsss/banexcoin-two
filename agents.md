# BanexReintegra - Agents

> **Anexo de [FLOW.md](FLOW.md).** Para entender cómo encajan estos agentes en el flujo completo del producto (upload → procesamiento → resultados), ver `FLOW.md` sección "Flujo end-to-end".

Mapa de agentes internos, workers y servicios especializados del sistema. En este proyecto, "agente" significa una unidad con responsabilidad única que puede ser ejecutada por un worker, un servicio NestJS o un endpoint bajo demanda.

---

## Principios de agentes

1. **Una responsabilidad por agente.** Parsear, calcular, conciliar, persistir y reportar son pasos separados.
2. **Contratos tipados.** Cada agente recibe DTOs o estructuras normalizadas; no comparte estado mutable global.
3. **Idempotencia.** Reintentar un job no debe duplicar transacciones ni reintegros.
4. **Errores observables.** Fallas se registran, actualizan `Upload.status` y se emiten por WebSocket.
5. **Independencia del core Banexcoin.** Los agentes solo operan con archivos cargados y datos persistidos localmente.
6. **Verificación frontend obligatoria.** Después de cualquier cambio en `frontend/`, ejecutar los tests Playwright con `bun run --cwd frontend test:e2e`. Si fallan, corregir el código o estabilizar los tests antes de dar el cambio por terminado.
7. **Commits en inglés.** Los commits deben escribirse en inglés.

---

## Mapa general

```text
Frontend Astro
  │
  │ POST /uploads
  ▼
UploadsController
  │
  ▼
UploadsService
  ├─ valida archivo
  ├─ calcula SHA-256
  ├─ crea o reutiliza Upload
  └─ encola process-upload
       │
       ▼
BullMQ uploads queue
       │
       ▼
ProcessUploadAgent
  ├─ ParseAgent
  ├─ TierAgent
  ├─ ReconcileAgent
  ├─ PersistenceAgent
  └─ EventsGateway
       │
       ├─ job:progress
       ├─ job:done
       └─ job:failed

ReportAgent se ejecuta bajo demanda desde endpoints de descarga.
AnomalyExplainerAgent es opcional y se ejecuta bajo demanda.
```

---

## ProcessUploadAgent

**Tipo:** BullMQ Worker
**Cola:** `uploads`
**Archivo objetivo:** `backend/src/jobs/process-upload.processor.ts`
**Responsabilidad:** orquestar el procesamiento completo de un upload.

### Contrato

```typescript
interface ProcessUploadJobData {
  uploadId: string
}
```

### Flujo

```typescript
@Processor('uploads')
export class ProcessUploadAgent extends WorkerHost {
  async process(job: Job<ProcessUploadJobData>) {
    const { uploadId } = job.data

    await this.emit(job, uploadId, 5, 'Leyendo archivo y validando estructura')
    const parsed = await this.parseAgent.run(uploadId)

    await this.emit(job, uploadId, 45, 'Calculando consumo mensual por usuario')
    const rebates = await this.tierAgent.run(uploadId, parsed)

    await this.emit(job, uploadId, 80, 'Conciliando contra extracto bancario')
    const anomalies = await this.reconcileAgent.run(uploadId, parsed)

    await this.emit(job, uploadId, 95, 'Guardando resultados')
    await this.persistenceAgent.run(uploadId, parsed, rebates, anomalies)

    await this.emit(job, uploadId, 100, 'Proceso completado')
    this.eventsGateway.emitDone({
      jobId: String(job.id),
      uploadId,
      rebateCount: rebates.length,
      anomalyCount: anomalies.length,
      parseErrorCount: parsed.parseErrors.length,
    })
  }
}
```

### Reglas

- Marcar `Upload.status = PROCESSING` al iniciar.
- Marcar `DONE` solo después de persistir todo.
- Marcar `FAILED` con `errorMessage` si cualquier agente falla.
- No hacer parsing, cálculos ni escritura directa dentro del orquestador.

---

## ParseAgent

**Tipo:** servicio NestJS interno
**Archivo objetivo:** `backend/src/jobs/agents/parse.agent.ts`
**Responsabilidad:** convertir Excel/CSV en filas tipadas y errores de parseo.

### Entradas

- `uploadId`.
- Archivo asociado al upload, guardado temporalmente o en almacenamiento local controlado.

### Salida

```typescript
interface ParseResult {
  period: string | null
  qrRows: QRTransactionRaw[]
  extractRows: ExtractRowRaw[]
  parseErrors: ParseError[]
  metadata: {
    fileName: string
    fileHash: string
    sheets: string[]
    rowCount: number
  }
}

interface QRTransactionRaw {
  rowNumber: number
  transactionId: string
  userExternalId?: string
  username?: string
  accountNumber: string
  amountUSDT: string
  amountBOB: string
  exchangeRate: string
  transactedAt?: string
  raw: Record<string, unknown>
}

interface ExtractRowRaw {
  rowNumber: number
  transactionId: string
  amountBOB: string
  transactedAt?: string
  raw: Record<string, unknown>
}

interface ParseError {
  sheetName: string
  rowNumber: number
  message: string
  raw?: Record<string, unknown>
}
```

### Hojas esperadas

| Hoja | Uso | Obligatoria |
|---|---|---|
| `Pago QR` | Fuente principal de transacciones QR | Sí |
| `EXTRACTO DE PAGOS` | Conciliación bancaria | No, pero recomendada |
| `Cobro QR` | Contexto adicional si existe | No |
| `Transfers` | Referencia para salida BanexTransfer | No |

### Validaciones

- `Pago QR` debe incluir `Transacción Id`, cuenta/usuario, monto Bs., monto USDT y tipo de cambio.
- `Transacción Id` no puede estar vacío.
- Duplicados dentro del mismo archivo se registran como error de parseo.
- Montos y tipo de cambio deben ser positivos.
- Filas inválidas no abortan todo el job salvo que falten headers críticos.

---

## TierAgent

**Tipo:** servicio NestJS interno
**Archivo objetivo:** `backend/src/jobs/agents/tier.agent.ts`
**Responsabilidad:** aplicar niveles de cashback y producir reintegros mensuales.

### Contrato

```typescript
interface TierAgent {
  run(uploadId: string, parsed: ParseResult): Promise<RebateResult[]>
}
```

### Flujo

1. Determina el período del `ParseResult` o del upload.
2. Carga `CashbackTier[]` activos para ese período.
3. Normaliza las transacciones QR válidas.
4. Llama al motor puro `calculateRebates()`.
5. Devuelve resultados sin persistir.

### Reglas

- No debe escribir en base de datos.
- No debe depender de HTTP ni de WebSocket.
- Debe trabajar con strings Decimal.
- Si no hay tiers activos, devuelve resultados con `tierId = null` y `rebatePercent = 0`.

---

## ReconcileAgent

**Tipo:** servicio NestJS interno
**Archivo objetivo:** `backend/src/jobs/agents/reconcile.agent.ts`
**Responsabilidad:** cruzar pagos QR contra extracto bancario.

### Contrato

```typescript
type AnomalyType = 'NO_EXTRACT' | 'NO_QR' | 'AMOUNT_MISMATCH'

interface Anomaly {
  transactionId: string
  type: AnomalyType
  qrAmountBOB?: string
  extractAmountBOB?: string
  deltaBOB?: string
  qrRowNumber?: number
  extractRowNumber?: number
}

interface ReconcileAgent {
  run(uploadId: string, parsed: ParseResult): Promise<Anomaly[]>
}
```

### Algoritmo

```text
qrById = Map(transactionId, qrRow)
extractById = Map(transactionId, extractRow)

for each qrRow:
  if extract missing:
    anomaly NO_EXTRACT
  else if abs(qr.amountBOB - extract.amountBOB) > tolerance:
    anomaly AMOUNT_MISMATCH

for each extractRow:
  if qr missing:
    anomaly NO_QR
```

### Configuración

| Variable | Default | Uso |
|---|---|---|
| `RECONCILE_TOLERANCE_BOB` | `0.01` | Diferencia permitida en Bs. |

---

## PersistenceAgent

**Tipo:** servicio NestJS interno
**Archivo objetivo:** `backend/src/jobs/agents/persistence.agent.ts`
**Responsabilidad:** escribir resultados en PostgreSQL de forma transaccional.

### Contrato

```typescript
interface PersistenceAgent {
  run(
    uploadId: string,
    parsed: ParseResult,
    rebates: RebateResult[],
    anomalies: Anomaly[],
  ): Promise<void>
}
```

### Escrituras

- Upsert de `UserAccount` por cuenta.
- Inserción de `QRTransaction` por `uploadId + transactionId`.
- Inserción o reemplazo controlado de `MonthlyRebate` por `uploadId + userAccountId`.
- Inserción de `ReconciliationAnomaly`.
- Inserción de `ParseError`.
- Actualización de `Upload`: período, conteos, estado final.

### Reglas

- Usar una transacción Prisma.
- No enviar eventos WebSocket.
- No generar archivos de reporte.
- Debe ser seguro ante reintentos del mismo job.

---

## ReportAgent

**Tipo:** servicio bajo demanda
**Archivo objetivo:** `backend/src/reports/report.agent.ts`
**Responsabilidad:** generar archivos descargables desde datos persistidos.

### Generadores

```typescript
interface ReportAgent {
  generateRebatesExcel(uploadId: string): Promise<Buffer>
  generateBanexTransfer(uploadId: string): Promise<Buffer>
  generateAnomaliesExcel(uploadId: string): Promise<Buffer>
}
```

### Excel de reintegros

Hojas:

- `Reintegros`.
- `Resumen por nivel`.
- `Anomalias`.
- `Errores de parseo`.

### BanexTransfer

Columnas mínimas:

```text
Nro | Cuenta Origen | Cuenta Destino | Monto USDT | Monto Bs | T/C promedio | Referencia
```

### Reglas

- No modifica estado.
- Es idempotente.
- Lee desde `MonthlyRebate`, no desde el archivo original.
- Formatea USDT con 8 decimales y Bs. con 2 decimales.

---

## EventsGateway

**Tipo:** Socket.IO Gateway
**Namespace:** `/jobs`
**Archivo objetivo:** `backend/src/events/events.gateway.ts`
**Responsabilidad:** notificar progreso al frontend.

### Eventos

```typescript
interface JobProgressEvent {
  jobId: string
  uploadId: string
  percent: number
  message: string
}

interface JobDoneEvent {
  jobId: string
  uploadId: string
  rebateCount: number
  anomalyCount: number
  parseErrorCount: number
}

interface JobFailedEvent {
  jobId: string
  uploadId: string
  error: string
}
```

### Reglas

- No exponer filas completas ni datos financieros por socket.
- El frontend debe poder recuperar estado vía REST si no recibió eventos.
- En producción, CORS debe limitarse al dominio del frontend.

---

## AnomalyExplainerAgent

**Tipo:** agente IA opcional bajo demanda
**Archivo objetivo:** `backend/src/reconciliation/anomaly-explainer.agent.ts`
**Responsabilidad:** resumir patrones de anomalías en lenguaje natural.

### Cuándo usarlo

- Solo si `ANTHROPIC_API_KEY` está configurado.
- Solo desde endpoint explícito, por ejemplo `POST /reconciliation/explain`.
- Nunca dentro del job principal de procesamiento.

### Contrato

```typescript
interface AnomalyExplainerAgent {
  explain(input: {
    uploadId: string
    anomalies: Anomaly[]
  }): Promise<string>
}
```

### Prompt recomendado

```text
Eres un analista financiero de Banexcoin Bolivia.
Explica en 2-3 oraciones el patron observado en estas anomalias de conciliacion.
Usa tono profesional, claro y sin tecnicismos.
No inventes causas; menciona hipotesis solo si los datos las sugieren.
```

### Reglas

- Enviar solo resumen agregado cuando sea posible, no filas completas.
- Si falla la API IA, devolver error controlado sin afectar conciliación.
- No almacenar la respuesta salvo que se agregue un requerimiento de auditoría.

---

## BullMQ

### Configuración recomendada

```typescript
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

### Concurrencia

Recomendado iniciar con concurrencia `1` para evitar conflictos de escritura y facilitar depuración. Subirla solo después de tener constraints e idempotencia verificadas.

---

## Estados del upload

| Estado | Responsable | Descripción |
|---|---|---|
| `PENDING` | `UploadsService` | Archivo aceptado y job encolado |
| `PROCESSING` | `ProcessUploadAgent` | Worker inició procesamiento |
| `DONE` | `PersistenceAgent` | Resultados persistidos correctamente |
| `FAILED` | `ProcessUploadAgent` | Falló algún paso y se guardó `errorMessage` |

---

## Eventos de progreso

| % | Agente | Mensaje |
|---|---|---|
| 5 | ProcessUploadAgent | Leyendo archivo y validando estructura |
| 25 | ParseAgent | Normalizando transacciones QR |
| 45 | TierAgent | Calculando consumo mensual por usuario |
| 65 | TierAgent | Aplicando niveles de reintegro |
| 80 | ReconcileAgent | Conciliando contra extracto bancario |
| 95 | PersistenceAgent | Guardando resultados |
| 100 | ProcessUploadAgent | Proceso completado |

---

## Testing por agente

| Agente | Tests mínimos |
|---|---|
| `ParseAgent` | headers faltantes, filas inválidas, duplicados, montos negativos |
| `TierAgent` | fronteras de niveles, tier superior sin tope, tiers vacíos |
| `ReconcileAgent` | `NO_EXTRACT`, `NO_QR`, `AMOUNT_MISMATCH`, tolerancia |
| `PersistenceAgent` | transacción rollback, reintento idempotente |
| `ReportAgent` | formato de columnas, decimales, salida reproducible |
| `EventsGateway` | payloads sin datos sensibles |

---

## Resumen

| Agente | Tipo | Disparo | Persiste |
|---|---|---|---|
| `ProcessUploadAgent` | BullMQ Worker | Job `process-upload` | Estado de upload |
| `ParseAgent` | Servicio interno | Worker | No |
| `TierAgent` | Servicio interno | Worker | No |
| `ReconcileAgent` | Servicio interno | Worker | No |
| `PersistenceAgent` | Servicio interno | Worker | Sí |
| `ReportAgent` | Servicio bajo demanda | Endpoint de descarga | No |
| `EventsGateway` | Socket.IO Gateway | Worker | No |
| `AnomalyExplainerAgent` | IA opcional | Endpoint explícito | No |
