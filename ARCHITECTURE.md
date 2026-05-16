# BanexReintegra - Architecture

Arquitectura objetivo para el sistema independiente de reintegros de Banexcoin Bolivia. Está alineada con la ficha técnica: carga manual de reportes, procesamiento mensual, clasificación por niveles, cálculo de cashback en USDT/Bs., generación de reportes operativos y preparación de archivos BanexTransfer.

> **Anexo de [FLOW.md](FLOW.md).** El flujo end-to-end, las personas y la estrategia de premios viven en `FLOW.md`. Este documento se centra en la estructura técnica: monorepo, modelo de datos, API, infra y dependencias.

---

## Estado actual del repositorio

El repositorio actual contiene un esqueleto funcional inicial:

```text
banexcoin-two/
  backend/                 # NestJS base
    src/app.module.ts      # Modulo raiz vacio
    src/main.ts            # Bootstrap basico en PORT
    package.json
    .env.example           # PORT=3000
  frontend/                # Astro + React + Tailwind v4 base
    astro.config.mjs       # React + @tailwindcss/vite
    src/styles/global.css  # @import "tailwindcss"
    package.json
    .env.example           # PUBLIC_API_URL=http://localhost:3000
  ficha tecnica.pdf
  Reportes Banexcoin Bolivia Hackaton 2026.xlsx
  design.md
  ARCHITECTURE.md
  agents.md
```

La documentación describe la arquitectura de implementación recomendada. Las carpetas y módulos mencionados deben crearse progresivamente sobre este esqueleto.

---

## Decisiones de stack

### Backend: NestJS

NestJS encaja porque permite módulos por feature, inyección de dependencias explícita, validación con DTOs, workers de BullMQ y WebSocket para progreso en tiempo real. Para este proyecto se debe evitar un `AppModule` monolítico y separar responsabilidades desde el inicio.

### Frontend: Astro + React Islands

Astro permite enviar HTML ligero y montar React solo donde existe interacción: dropzone, progreso por socket, tablas, editor de niveles y simulador. Esto reduce complejidad frente a una SPA completa y funciona bien para una herramienta de hackathon con dashboards y flujos operativos.

### Persistencia: PostgreSQL + Prisma

PostgreSQL aporta constraints, transacciones y tipos `Decimal`. Prisma da una DX rápida para el hackathon y migraciones versionadas. Los cálculos monetarios no deben usar `Float`.

### Jobs: BullMQ + Redis

El procesamiento de archivos no debe bloquear el request HTTP. BullMQ permite progreso, reintentos y aislamiento de errores.

---

## Arquitectura objetivo

```text
                         Frontend Astro
  ┌────────────────────────────────────────────────────────────┐
  │ Pages .astro                                               │
  │  ├─ Dashboard / Uploads / Rebates / Tiers / Reconciliation │
  │  └─ React Islands                                          │
  │     ├─ UploadDropzone                                      │
  │     ├─ JobProgress (Socket.IO)                             │
  │     ├─ RebatesTable                                        │
  │     ├─ TiersEditor                                         │
  │     └─ WhatIfSimulator                                     │
  └───────────────┬──────────────────────────────┬─────────────┘
                  │ HTTP REST                    │ WebSocket /jobs
                  ▼                              ▼
                         Backend NestJS
  ┌────────────────────────────────────────────────────────────┐
  │ Controllers + DTOs + ValidationPipe                         │
  │  ├─ uploads                                                 │
  │  ├─ tiers                                                   │
  │  ├─ rebates                                                 │
  │  ├─ reconciliation                                          │
  │  ├─ reports                                                 │
  │  ├─ events                                                  │
  │  └─ jobs                                                    │
  └───────────────┬──────────────────────────────┬─────────────┘
                  │                              │
                  ▼                              ▼
            PostgreSQL                      Redis / BullMQ
```

---

## Estructura recomendada

### Backend

```text
backend/src/
  main.ts
  app.module.ts
  common/
    filters/http-exception.filter.ts
    interceptors/logging.interceptor.ts
    pipes/parse-period.pipe.ts
  config/
    app.config.ts
    validation.schema.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  uploads/
    dto/create-upload.dto.ts
    uploads.controller.ts
    uploads.module.ts
    uploads.service.ts
  tiers/
    dto/create-tier.dto.ts
    dto/update-tier.dto.ts
    tiers.controller.ts
    tiers.module.ts
    tiers.service.ts
  rebates/
    rebates.controller.ts
    rebates.module.ts
    rebates.service.ts
  reconciliation/
    reconciliation.controller.ts
    reconciliation.module.ts
    reconciliation.service.ts
    anomaly-explainer.agent.ts
  reports/
    reports.controller.ts
    reports.module.ts
    report.agent.ts
  jobs/
    bull.config.ts
    jobs.module.ts
    process-upload.processor.ts
    agents/
      parse.agent.ts
      tier.agent.ts
      reconcile.agent.ts
      persistence.agent.ts
  events/
    events.gateway.ts
    events.module.ts
  domain/
    money.ts
    tier-engine.ts
    reconcile.ts
    excel-parser.ts
```

### Frontend

```text
frontend/src/
  env.d.ts
  styles/global.css
  layouts/AppShell.astro
  components/
    Sidebar.astro
    Topbar.astro
    StatCard.astro
  pages/
    index.astro
    uploads/index.astro
    rebates/index.astro
    tiers/index.astro
    reconciliation/index.astro
    simulator/index.astro
  islands/
    upload/UploadDropzone.tsx
    upload/JobProgress.tsx
    rebates/RebatesTable.tsx
    tiers/TiersEditor.tsx
    reconciliation/AnomalyPanel.tsx
    simulator/WhatIfSimulator.tsx
  lib/
    api.ts
    socket.ts
    money.ts
    stores.ts
```

---

## Modulos NestJS

### `AppModule`

Responsabilidad: composición del sistema. Debe importar módulos, no declarar lógica.

Recomendado:

- `ConfigModule.forRoot({ isGlobal: true, validationSchema })`.
- `PrismaModule` como módulo compartido.
- `UploadsModule`, `TiersModule`, `RebatesModule`, `ReconciliationModule`, `ReportsModule`, `JobsModule`, `EventsModule`.
- Evitar dependencias circulares. Si dos módulos necesitan reaccionar entre sí, usar eventos o mover lógica compartida a `domain/`.

### `UploadsModule`

Recibe archivos, valida formato y registra uploads.

Flujo:

1. Recibe `multipart/form-data`.
2. Valida extensión y MIME.
3. Calcula SHA-256 para idempotencia.
4. Guarda `Upload` con estado `PENDING`.
5. Encola job `process-upload` con `uploadId`.
6. Devuelve `{ uploadId, jobId, status }`.

### `JobsModule`

Orquesta el procesamiento asíncrono con BullMQ.

Reglas:

- Workers con constructor injection.
- Job idempotente por `uploadId`.
- Reintentos configurados con backoff exponencial.
- Si falla, actualizar `Upload.status = FAILED` y emitir `job:failed`.

### `TiersModule`

Administra reglas de niveles.

Reglas:

- Validar rangos sin solapamiento.
- Guardar vigencia con `validFrom` y `validTo`.
- No eliminar físicamente niveles usados en históricos; desactivar o cerrar vigencia.

### `RebatesModule`

Consulta resultados ya calculados.

Reglas:

- Paginación obligatoria.
- Filtros por `uploadId`, período, nivel, usuario/cuenta y estado de pago.
- No recalcular en endpoints de lectura.

### `ReconciliationModule`

Consulta anomalías y expone explicación opcional con IA.

Reglas:

- Endpoint de anomalías no debe depender de IA.
- El agente IA es opcional y falla de manera aislada.
- La tolerancia se configura con `RECONCILE_TOLERANCE_BOB`.

### `ReportsModule`

Genera archivos desde datos persistidos.

Reglas:

- Idempotente: leer y generar en memoria.
- No guardar archivos generados permanentemente salvo requerimiento explícito.
- Excel de reintegros y BanexTransfer deben ser reproducibles por `uploadId`.

---

## Modelo de datos recomendado

```prisma
enum UploadStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

enum AnomalyType {
  NO_EXTRACT
  NO_QR
  AMOUNT_MISMATCH
}

model Upload {
  id              String          @id @default(cuid())
  originalName    String
  fileHash        String          @unique
  period          String?
  status          UploadStatus    @default(PENDING)
  rowCount        Int             @default(0)
  parseErrorCount Int             @default(0)
  errorMessage    String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  transactions    QRTransaction[]
  rebates         MonthlyRebate[]
  anomalies       ReconciliationAnomaly[]
}

model UserAccount {
  id           String          @id @default(cuid())
  externalId   String?
  username     String?
  accountNumber String         @unique
  createdAt    DateTime        @default(now())
  transactions QRTransaction[]
  rebates      MonthlyRebate[]
}

model QRTransaction {
  id             String      @id @default(cuid())
  uploadId       String
  userAccountId  String
  transactionId  String
  amountUSDT     Decimal     @db.Decimal(20, 8)
  amountBOB      Decimal     @db.Decimal(20, 2)
  exchangeRate   Decimal     @db.Decimal(20, 8)
  transactedAt   DateTime?
  rawRow          Json
  upload         Upload      @relation(fields: [uploadId], references: [id])
  userAccount    UserAccount @relation(fields: [userAccountId], references: [id])

  @@unique([uploadId, transactionId])
  @@index([transactionId])
  @@index([userAccountId])
}

model CashbackTier {
  id              String    @id @default(cuid())
  name            String
  level           Int
  minAmountBOB    Decimal   @db.Decimal(20, 2)
  maxAmountBOB    Decimal?  @db.Decimal(20, 2)
  rebatePercent   Decimal   @db.Decimal(6, 3)
  active          Boolean   @default(true)
  validFromPeriod String
  validToPeriod   String?
  createdAt       DateTime  @default(now())

  @@index([active, validFromPeriod])
}

model MonthlyRebate {
  id              String      @id @default(cuid())
  uploadId        String
  userAccountId   String
  period          String
  tierId          String?
  totalSpentBOB   Decimal     @db.Decimal(20, 2)
  totalSpentUSDT  Decimal     @db.Decimal(20, 8)
  avgExchangeRate Decimal     @db.Decimal(20, 8)
  rebatePercent   Decimal     @db.Decimal(6, 3)
  rebateUSDT      Decimal     @db.Decimal(20, 8)
  rebateBOB       Decimal     @db.Decimal(20, 2)
  paidOut         Boolean     @default(false)
  paidOutAt       DateTime?
  upload          Upload      @relation(fields: [uploadId], references: [id])
  userAccount     UserAccount @relation(fields: [userAccountId], references: [id])

  @@unique([uploadId, userAccountId])
  @@index([period])
}

model ReconciliationAnomaly {
  id            String      @id @default(cuid())
  uploadId      String
  transactionId String
  type          AnomalyType
  qrAmountBOB   Decimal?    @db.Decimal(20, 2)
  extractAmountBOB Decimal? @db.Decimal(20, 2)
  deltaBOB      Decimal?    @db.Decimal(20, 2)
  rawContext    Json?
  resolved      Boolean     @default(false)
  createdAt     DateTime    @default(now())
  upload        Upload      @relation(fields: [uploadId], references: [id])

  @@index([uploadId, type])
}

model ParseError {
  id        String   @id @default(cuid())
  uploadId  String
  sheetName String
  rowNumber Int
  message   String
  rawRow    Json?
  createdAt DateTime @default(now())
}
```

---

## Flujo principal de datos

```text
Usuario sube Excel/CSV
  │
  ▼
POST /uploads
  ├─ Validar archivo
  ├─ Calcular SHA-256
  ├─ Reusar Upload si el hash ya existe
  ├─ Guardar Upload PENDING
  └─ Encolar process-upload
       │
       ▼
Worker BullMQ
  ├─ ParseAgent: hojas y filas normalizadas
  ├─ TierAgent: consumo mensual + nivel + cashback
  ├─ ReconcileAgent: Pago QR vs EXTRACTO DE PAGOS
  ├─ PersistenceAgent: transaccion Postgres
  └─ EventsGateway: progreso/done/failed
       │
       ▼
Frontend actualiza JobProgress y habilita reportes
```

---

## API REST objetivo

### Uploads

```text
POST   /uploads                       # Subir Excel/CSV, registrar hash y encolar job
GET    /uploads                       # Listar uploads con estado
GET    /uploads/:id                   # Detalle de un upload
GET    /uploads/:id/status            # Estado recuperable si se perdio WebSocket
```

### Tiers

```text
GET    /tiers?period=YYYY-MM
POST   /tiers
PATCH  /tiers/:id
POST   /tiers/validate
POST   /tiers/simulate
```

### Rebates

```text
GET    /rebates?uploadId=&period=&tier=&search=&page=&limit=
GET    /rebates/:id
PATCH  /rebates/:id/mark-paid
GET    /rebates/summary?uploadId=
```

### Reconciliation

```text
GET    /reconciliation?uploadId=&type=&resolved=
GET    /reconciliation/stats?uploadId=
PATCH  /reconciliation/:id/resolve
POST   /reconciliation/explain
```

### Reports

```text
GET    /reports/uploads/:id/rebates.xlsx          # Excel de reintegros con resumen, anomalías y errores
GET    /reports/uploads/:id/banex-transfer.csv    # Archivo operativo para pagos masivos internos
GET    /reports/uploads/:id/anomalies.xlsx        # Reporte filtrable de conciliación
GET    /reports/uploads/:id/balance-sheet.xlsx    # Cuadre DEBE/HABER inspirado en hoja Saldos
```

---

## Eventos WebSocket

Namespace: `/jobs`.

```text
job:progress  { jobId, uploadId, percent, message }
job:done      { jobId, uploadId, rebateCount, anomalyCount, parseErrorCount }
job:failed    { jobId, uploadId, error }
```

Reglas:

- El cliente debe poder reconectar y consultar `/uploads/:id/status` si perdió eventos.
- El backend no debe emitir datos sensibles por socket; solo progreso y conteos.
- `jobId` debe ser estable, preferiblemente igual a `uploadId`.

---

## Calculo de reintegros

Entrada del motor puro:

```typescript
export interface TierEngineInput {
  transactions: Array<{
    userAccountId: string
    amountBOB: string
    amountUSDT: string
    exchangeRate: string
  }>
  tiers: Array<{
    id: string
    level: number
    minAmountBOB: string
    maxAmountBOB: string | null
    rebatePercent: string
  }>
}
```

Salida:

```typescript
export interface RebateResult {
  userAccountId: string
  totalSpentBOB: string
  totalSpentUSDT: string
  avgExchangeRate: string
  tierId: string | null
  rebatePercent: string
  rebateUSDT: string
  rebateBOB: string
}
```

Invariantes:

1. El total mensual por usuario se calcula sumando `amountBOB` de sus pagos QR válidos.
2. El nivel se decide por `totalSpentBOB` y tiers vigentes del período.
3. `rebateBOB = totalSpentBOB * rebatePercent / 100`.
4. `rebateUSDT = rebateBOB / avgExchangeRate`.
5. `avgExchangeRate` debe ser ponderado por monto BOB.
6. Todas las operaciones usan Decimal/string; nunca `number` para dinero.

---

## Conciliacion

Entradas:

- Hoja `Pago QR`: transacciones fuente del cashback.
- Hoja `EXTRACTO DE PAGOS`: movimientos bancarios para control.

Algoritmo:

```text
qrById = Map(transactionId, amountBOB)
extractById = Map(transactionId, amountBOB)

for each transactionId in qrById:
  if missing in extractById -> NO_EXTRACT
  else if abs(qrAmount - extractAmount) > tolerance -> AMOUNT_MISMATCH

for each transactionId in extractById:
  if missing in qrById -> NO_QR
```

La tolerancia por defecto es `0.01` Bs. y se configura con `RECONCILE_TOLERANCE_BOB`.

---

## Reportes

### Excel de reintegros

Hojas mínimas:

1. `Reintegros`: usuario, cuenta, consumo Bs., consumo USDT, nivel, porcentaje, reintegro USDT, reintegro Bs., T/C promedio.
2. `Resumen por nivel`: cantidad de usuarios, total consumo, total reintegro.
3. `Anomalias`: tipo, transacción, delta, contexto.
4. `Errores de parseo`: hoja, fila, mensaje.

### BanexTransfer

Formato operativo mínimo:

```text
Nro | Cuenta Origen | Cuenta Destino | Monto USDT | Monto Bs | T/C promedio | Referencia
```

Referencia sugerida: `REINTEGRO-{period}-{uploadIdShort}`.

---

## Configuracion y seguridad

### Variables backend

```text
PORT=3000
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
MAX_UPLOAD_SIZE_MB=50
RECONCILE_TOLERANCE_BOB=0.01
GEMINI_API_KEY=
```

`AnomalyExplainerAgent` usa `@google/genai` con `models.generateContent` y el
modelo `gemini-3-flash-preview`, suficiente para una explicación breve y sin
estado sobre un resumen agregado de anomalías.

### Variables frontend

```text
PUBLIC_API_URL=http://localhost:3000
```

### Bootstrap NestJS recomendado

- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- CORS restringido a origen del frontend en producción.
- Logger contextual.
- Filtro global de excepciones.
- `app.enableShutdownHooks()` para cerrar Prisma, Redis y workers.

---

## Testing

Prioridad de tests:

1. `tier-engine`: fronteras de niveles, nivel superior sin tope, tiers vacíos, promedio ponderado.
2. `reconcile`: los tres tipos de anomalía y tolerancia.
3. `excel-parser`: headers faltantes, filas inválidas, duplicados, montos negativos.
4. `uploads.service`: idempotencia por hash y encolado.
5. E2E mínimo: `POST /uploads` con archivo de prueba y consulta de estado.

---

## Plan de implementacion por fases

### Fase 1 - Base funcional

- Configurar NestJS con módulos, ConfigModule, Prisma y ValidationPipe.
- Crear Prisma schema y migración inicial.
- Implementar upload, hash e idempotencia.
- Implementar parser mínimo para hoja `Pago QR`.

### Fase 2 - Motor de negocio

- Implementar `tier-engine` puro.
- Implementar CRUD/validación de tiers.
- Procesar job BullMQ y persistir reintegros.
- Emitir progreso por Socket.IO.

### Fase 3 - UI operativa

- Crear `AppShell` Astro.
- Implementar upload con progreso.
- Implementar tabla de reintegros y dashboard.
- Implementar descarga de reportes.

### Fase 4 - Diferenciadores

- Conciliación contra extracto.
- Simulador what-if.
- Explicación IA opcional de anomalías.
- Marcado de pagos y auditoría extendida.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Excel con columnas variables | Parser con aliases y errores por fila |
| Duplicados por carga repetida | SHA-256 único + `@@unique([uploadId, transactionId])` |
| Errores por floating point | Decimal/string en dominio y DB |
| Jobs largos bloqueando HTTP | BullMQ worker separado |
| Pérdida de eventos WebSocket | Endpoint de estado por upload |
| Rangos de tiers mal configurados | Validación antes de guardar y simulación |
