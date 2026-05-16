# BanexReintegra — Architecture

---

## Estructura del monorepo

```
banexreintegra/
├── apps/
│   ├── web/                        # Astro 4 + React Islands
│   │   ├── src/
│   │   │   ├── pages/              # File-based routing de Astro
│   │   │   │   ├── index.astro     # Dashboard ejecutivo
│   │   │   │   ├── uploads/
│   │   │   │   │   └── index.astro # Historial + nueva subida
│   │   │   │   ├── rebates/
│   │   │   │   │   └── index.astro # Tabla de reintegros
│   │   │   │   ├── tiers/
│   │   │   │   │   └── index.astro # Configuración de niveles
│   │   │   │   ├── reconciliation/
│   │   │   │   │   └── index.astro # Anomalías de conciliación
│   │   │   │   └── simulator/
│   │   │   │       └── index.astro # Simulador what-if
│   │   │   ├── layouts/
│   │   │   │   └── DashboardLayout.astro  # Sidebar + topbar
│   │   │   ├── islands/            # Componentes React hidratados
│   │   │   │   ├── upload/
│   │   │   │   │   ├── UploadDropzone.tsx  # client:load
│   │   │   │   │   └── JobProgress.tsx     # client:load (WebSocket)
│   │   │   │   ├── rebates/
│   │   │   │   │   ├── RebatesTable.tsx    # client:load (TanStack)
│   │   │   │   │   └── UserDrawer.tsx      # client:load
│   │   │   │   ├── tiers/
│   │   │   │   │   └── TiersEditor.tsx     # client:load
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── KpiCards.tsx        # client:load (counter anim)
│   │   │   │   │   └── Charts.tsx          # client:visible (Recharts)
│   │   │   │   ├── reconciliation/
│   │   │   │   │   └── AnomalyPanel.tsx    # client:load
│   │   │   │   └── simulator/
│   │   │   │       └── WhatIfSimulator.tsx # client:load (puro, sin API)
│   │   │   ├── components/         # Componentes Astro estáticos
│   │   │   │   ├── Sidebar.astro
│   │   │   │   ├── Topbar.astro
│   │   │   │   └── ui/             # shadcn/ui wrappers
│   │   │   └── lib/
│   │   │       ├── api.ts          # fetch helpers hacia NestJS
│   │   │       └── socket.ts       # Socket.IO client (usado por islands)
│   │
│   └── api/                        # NestJS
│       └── src/
│           ├── uploads/            # Módulo: recibir y parsear archivos
│           ├── tiers/              # Módulo: CRUD niveles de cashback
│           ├── rebates/            # Módulo: consultar y exportar reintegros
│           ├── reconciliation/     # Módulo: cruzar QR vs extracto
│           ├── reports/            # Módulo: generar Excel y BanexTransfer
│           ├── jobs/               # BullMQ workers
│           └── events/             # Gateway Socket.IO
│
├── packages/
│   ├── types/                      # DTOs y tipos compartidos front↔back
│   │   └── src/
│   │       ├── upload.ts
│   │       ├── qr-transaction.ts
│   │       ├── cashback-tier.ts
│   │       ├── monthly-rebate.ts
│   │       └── reconciliation.ts
│   │
│   ├── utils/                      # Lógica de negocio pura (sin frameworks)
│   │   └── src/
│   │       ├── tier-engine.ts      # calculateRebates() — núcleo del cashback
│   │       ├── money.ts            # decimal.js wrappers
│   │       ├── excel-parser.ts     # Normalización de hojas Excel
│   │       └── reconcile.ts        # Cruce QR vs extracto
│   │
│   └── ui/                         # Componentes shadcn compartidos
│
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Modelo de datos (Prisma)

```prisma
model User {
  id           Int             @id @default(autoincrement())
  externalId   String          @unique          // ID del sistema Banexcoin
  username     String          @unique          // "Creado por" del Excel
  accountId    Int             @unique          // "Número de Cuenta"
  transactions QRTransaction[]
  rebates      MonthlyRebate[]
}

model Upload {
  id              String        @id @default(cuid())
  filename        String
  fileHash        String        @unique          // SHA-256 → idempotencia
  period          String                          // "2025-05"
  status          UploadStatus                   // PENDING | PROCESSING | DONE | FAILED
  rowCount        Int           @default(0)
  errorMessage    String?
  createdAt       DateTime      @default(now())
  transactions    QRTransaction[]
  rebates         MonthlyRebate[]
}

model QRTransaction {
  id                    String   @id @default(cuid())
  uploadId              String
  upload                Upload   @relation(fields: [uploadId], references: [id])
  userId                Int
  user                  User     @relation(fields: [userId], references: [id])
  transactionId         String   @unique          // "Transacción Id" — clave de conciliación
  status                String
  amountUSDT            Decimal  @db.Decimal(20, 8)   // "Monto intercambio"
  amountBOB             Decimal  @db.Decimal(20, 8)   // "Monto Pagado"
  exchangeRate          Decimal  @db.Decimal(20, 8)   // "Precio"
  commission            Decimal  @db.Decimal(20, 8)
  transactedAt          DateTime
  reconciledWithExtract Boolean  @default(false)
  extractMismatch       String?                       // descripción si difiere
}

model CashbackTier {
  id              Int       @id @default(autoincrement())
  name            String                          // "Nivel 1", "Bronce", etc.
  minAmountBOB    Decimal   @db.Decimal(20, 2)
  maxAmountBOB    Decimal?  @db.Decimal(20, 2)   // null = sin tope superior
  rebatePercent   Decimal   @db.Decimal(5, 2)    // 1.00, 1.50, 2.00 ...
  active          Boolean   @default(true)
  validFrom       DateTime
  validTo         DateTime?
}

model MonthlyRebate {
  id              String    @id @default(cuid())
  uploadId        String
  upload          Upload    @relation(fields: [uploadId], references: [id])
  userId          Int
  user            User      @relation(fields: [userId], references: [id])
  period          String                           // "2025-05"
  totalSpentBOB   Decimal   @db.Decimal(20, 2)
  tierId          Int
  rebatePercent   Decimal   @db.Decimal(5, 2)
  rebateUSDT      Decimal   @db.Decimal(20, 8)
  rebateBOB       Decimal   @db.Decimal(20, 2)
  avgExchangeRate Decimal   @db.Decimal(20, 8)   // promedio ponderado del mes
  paidOut         Boolean   @default(false)
  paidOutAt       DateTime?

  @@unique([userId, period])                       // un solo reintegro por mes por usuario
}
```

---

## Flujo de datos principal

```
Usuario sube Excel
       │
       ▼
POST /uploads  (multipart)
       │
       ├── Validar MIME + extensión
       ├── Calcular SHA-256
       ├── Verificar idempotencia (¿hash ya existe?)
       └── Persistir Upload{status: PENDING}
              │
              ▼
       Encolar job BullMQ
       "process-upload" (jobId = uploadId)
              │
              ▼ (worker asíncrono)
       excel-parser.ts
       ├── Leer hoja "Pago QR"
       ├── Validar headers
       ├── Normalizar filas → QRTransactionRaw[]
       └── Upsert Users + insertar QRTransactions
              │
              ▼
       tier-engine.ts  ← función pura, testeable aislada
       ├── Agrupar transacciones por usuario
       ├── Sumar totalSpentBOB por usuario
       ├── Calcular avg exchange rate (promedio ponderado)
       ├── Asignar nivel según CashbackTiers activos
       └── Calcular rebateUSDT y rebateBOB
              │
              ▼
       Persistir MonthlyRebates[]
       Actualizar Upload{status: DONE}
              │
              ▼ (Socket.IO)
       Emit "upload:done" → cliente actualiza UI
```

---

## API REST

### Uploads

```
POST   /uploads                    # Subir Excel, encolar job
GET    /uploads                    # Listar uploads con estado
GET    /uploads/:id                # Detalle de un upload
GET    /uploads/:id/report         # Descargar Excel de reintegros
GET    /uploads/:id/banex-transfer # Descargar archivo BanexTransfer
```

### Tiers

```
GET    /tiers                      # Listar niveles activos
POST   /tiers                      # Crear nivel
PATCH  /tiers/:id                  # Editar nivel
DELETE /tiers/:id                  # Desactivar nivel
POST   /tiers/validate             # Validar exclusión mutua (simulador)
```

### Rebates

```
GET    /rebates?uploadId=X&tier=Y&search=Z&page=N   # Tabla paginada
GET    /rebates/:id                                  # Detalle de un reintegro
GET    /rebates/summary?uploadId=X                   # Agregados para KPIs
PATCH  /rebates/:id/mark-paid                        # Marcar como pagado
```

### Reconciliation

```
GET    /reconciliation?uploadId=X  # Anomalías del upload
GET    /reconciliation/stats?uploadId=X  # Conteo por tipo de anomalía
```

---

## Eventos WebSocket

```
Cliente se conecta al namespace /jobs

Servidor emite:
  "job:progress"  { jobId, percent, message }
  "job:done"      { jobId, uploadId, rebateCount, anomalyCount }
  "job:failed"    { jobId, error }
```

---

## tier-engine — interfaz pública

```typescript
// packages/utils/src/tier-engine.ts

export interface TierEngineInput {
  transactions: {
    userId: number
    amountBOB: string       // string para decimal.js, no float
    amountUSDT: string
    exchangeRate: string
  }[]
  tiers: {
    id: number
    minAmountBOB: string
    maxAmountBOB: string | null
    rebatePercent: string
  }[]
}

export interface RebateResult {
  userId: number
  totalSpentBOB: string
  avgExchangeRate: string
  tierId: number | null     // null si no cae en ningún nivel
  rebatePercent: string
  rebateUSDT: string
  rebateBOB: string
}

export function calculateRebates(input: TierEngineInput): RebateResult[]
```

La función no toca base de datos ni HTTP. Recibe strings, devuelve strings. Testeable con cualquier runner.

---

## Generador de BanexTransfer

El archivo de salida sigue el formato interno de Banexcoin para transferencias masivas:

```
Nro | Cuenta Origen | Cuenta Destino | Monto USDT | Monto BOB | T/C | Ref
 1  | 10001 (tesorería) | 20045 | 1.45000000 | 10.15 | 6.99... | REINTEGRO-2025-05
 2  | 10001 | 20089 | 0.87000000 | 6.08 | 6.98... | REINTEGRO-2025-05
```

Se regenera idempotentemente desde `MonthlyRebate[]`. Nunca se guarda en disco permanentemente.

---

## Conciliación automática

```
Pago QR (5.325 filas)          EXTRACTO DE PAGOS (5.327 filas)
     │                                   │
     └──────── JOIN por transactionId ───┘
                        │
              ┌─────────┴──────────┐
              │                    │
         Coinciden            No coinciden
              │                    │
         ✅ OK            ┌────────┴────────┐
                          │                 │
                   Solo en QR       Solo en extracto   Ambos pero monto ≠
                   (🔴 rojo)         (🟡 amarillo)       (🟠 naranja)
```

---

## Infra y despliegue

### Local (desarrollo)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: banexreintegra
      POSTGRES_PASSWORD: banex_local
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://postgres:banex_local@postgres/banexreintegra
      REDIS_URL: redis://redis:6379
    ports: ["3001:3001"]
    depends_on: [postgres, redis]

  web:
    build: ./apps/web
    environment:
      PUBLIC_API_URL: http://localhost:3001
    ports: ["3000:3000"]
    depends_on: [api]
```

### Producción (hackatón)

| Servicio | Plataforma | Por qué |
|---|---|---|
| `apps/web` | Vercel | Deploy en 1 click desde GitHub, CDN global |
| `apps/api` | Railway | Soporta Dockerfile, variables de entorno simples |
| PostgreSQL | Railway (plugin) | Mismo proyecto, misma red privada |
| Redis | Railway (plugin) | Igual |

Variables de entorno necesarias en producción:
```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
MAX_UPLOAD_SIZE_MB=50
```

---

## Dependencias clave

### apps/api
```json
{
  "@nestjs/core": "^10",
  "@nestjs/platform-express": "^10",
  "@nestjs/swagger": "^7",
  "@nestjs/websockets": "^10",
  "@nestjs/platform-socket.io": "^10",
  "bullmq": "^5",
  "prisma": "^5",
  "@prisma/client": "^5",
  "exceljs": "^4",
  "papaparse": "^5",
  "decimal.js": "^10",
  "class-validator": "^0.14",
  "class-transformer": "^0.5",
  "multer": "^1",
  "crypto": "node built-in"
}
```

### apps/web
```json
{
  "astro": "^4",
  "@astrojs/react": "^3",
  "@astrojs/tailwind": "^5",
  "react": "^18",
  "react-dom": "^18",
  "@tanstack/react-query": "^5",
  "@tanstack/react-table": "^8",
  "socket.io-client": "^4",
  "react-dropzone": "^14",
  "xlsx": "^0.18",
  "recharts": "^2",
  "framer-motion": "^11",
  "decimal.js": "^10",
  "tailwindcss": "^3",
  "class-variance-authority": "^0.7",
  "clsx": "^2"
}
```

**Integraciones Astro necesarias en `astro.config.mjs`:**
```javascript
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',            // SSG; cambiar a 'server' si necesitas SSR
})
```

**Regla de hidratación por tipo de island:**
| Island | Directiva | Razón |
|---|---|---|
| `UploadDropzone` | `client:load` | Interacción inmediata al entrar |
| `JobProgress` | `client:load` | WebSocket activo desde el primer render |
| `RebatesTable` | `client:load` | TanStack Table necesita DOM |
| `Charts` | `client:visible` | Solo hidrata cuando entra al viewport |
| `WhatIfSimulator` | `client:load` | Necesita estado React para deslizadores |
| `KpiCards` | `client:load` | Animación de counter al montar |

### packages/utils
```json
{
  "decimal.js": "^10"
}
```

---

## Tests

```
packages/utils/
  tier-engine.test.ts      # 15+ casos: cada nivel, fronteras, promedio ponderado
  reconcile.test.ts        # casos de cada tipo de anomalía
  money.test.ts            # operaciones con decimal.js

apps/api/
  uploads/uploads.service.spec.ts
  rebates/rebates.service.spec.ts

# Runner: Vitest (compatible con ESM y monorepo Turborepo)
```

Casos obligatorios en `tier-engine.test.ts`:
- Usuario con 0 transacciones
- Usuario exactamente en el mínimo de un nivel
- Usuario exactamente en el máximo de un nivel
- Usuario un centavo por debajo de subir de nivel
- Tipo de cambio variable: 3 transacciones con tasas distintas → verificar promedio ponderado
- Nivel sin tope superior (el más alto)
- Configuración de tiers vacía (sin niveles activos)

---

## Invariantes de negocio

1. Los rangos de niveles no se solapan. Un monto cae en exactamente un nivel o en ninguno.
2. El reintegro en USDT se calcula como `(totalSpentBOB × rebatePercent) / avgExchangeRate`.
3. `avgExchangeRate` es la media ponderada: `Σ(amountBOB × exchangeRate) / Σ(amountBOB)`.
4. Un usuario tiene máximo un `MonthlyRebate` por período (constraint `@@unique([userId, period])`).
5. El mismo archivo (mismo SHA-256) no genera un segundo upload. Devuelve el upload existente.
6. Los montos monetarios nunca se guardan como `Float`. Siempre `DECIMAL(20,8)` en Postgres y `string` en tránsito.
