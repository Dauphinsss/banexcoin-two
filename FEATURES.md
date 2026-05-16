# BanexReintegra — Features

> **Anexo de [FLOW.md](FLOW.md).** Descompone el flujo end-to-end en funcionalidades atómicas, ordenadas por etapa. Cada feature es una unidad de trabajo asignable, testeable y demostrable.

---

## Cómo leer este documento

Cada feature tiene la siguiente estructura:

```
F[etapa].[n] · Nombre corto
─────────────────────────────────────
Prioridad   · P0 (MVP) | P1 (diferenciador) | P2 (nice-to-have)
Esfuerzo    · S (<2h) | M (2-5h) | L (5-10h)
Premio      · qué categoría refuerza
FLOW ref    · sección del FLOW.md
Módulo      · dónde vive en el código

Descripción
  Una o dos líneas describiendo qué hace.

Aceptación
  - Criterio observable 1
  - Criterio observable 2

Dependencias
  · F[x].[y] · razón
```

**Convenciones de prioridad**

| Prio | Significado | Cuándo |
|---|---|---|
| **P0** | Sin esto no hay demo. | Día 1-2 obligatorio. |
| **P1** | Sin esto pierdes una categoría de premio. | Día 2-3 obligatorio. |
| **P2** | Nice-to-have, refuerza el pitch. | Día 3 si hay tiempo. |

**Mapa de etapas del flujo:**

```
F0  Cimientos       (setup monorepo, infra local)
F1  Ingesta         (upload, parser, idempotencia)
F2  Cálculo         (tier-engine, niveles)
F3  Conciliación    (Pago QR ↔ Extracto)
F4  Persistencia    (Prisma transactions, audit trail)
F5  Visualización   (dashboard, tabla, drawer)
F6  Reportes        (Excel, BanexTransfer, Cuadre)
F7  Configuración   (CRUD de tiers)
F8  Simulador       (what-if en navegador)
F9  IA              (Claude para anomalías)
F10 Polish          (animaciones, dark mode, mobile, pitch)
```

---

## F0 · Cimientos

### F0.1 · Setup monorepo Turborepo + pnpm

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 14 (anexos técnicos)
- **Módulo:** raíz del repo

Estructura `apps/{api,web}` + `packages/{types,utils,ui}` con `turbo.json` y `pnpm-workspace.yaml`.

**Aceptación:**
- `pnpm install` en raíz instala todo
- `pnpm dev` levanta web y api en paralelo
- `packages/types` se importa desde ambos apps

### F0.2 · Docker Compose local

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 5 (master flow)
- **Módulo:** `docker-compose.yml`

Postgres 16 + Redis 7-alpine + healthchecks. Persiste volumen de DB localmente.

**Aceptación:**
- `docker compose up -d` arranca Postgres en 5432 y Redis en 6379
- `pnpm db:push` aplica el schema Prisma

### F0.3 · Prisma schema y primera migración

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 (persistencia)
- **Módulo:** `apps/api/prisma/schema.prisma`

Modelos: `User`, `Upload`, `QRTransaction`, `CashbackTier`, `MonthlyRebate`, `Anomaly`, `ParseError`.

**Aceptación:**
- Todas las columnas monetarias son `Decimal @db.Decimal(20,8)`
- Constraints: `Upload.fileHash unique`, `MonthlyRebate @@unique([userId, period])`
- `prisma migrate dev` genera la migración inicial

### F0.4 · `tier-engine` como paquete puro

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Innovación
- **FLOW ref:** sección 7.3 (simulador) + sección 4.6 (innovación)
- **Módulo:** `packages/utils/src/tier-engine.ts`

Función pura `calculateRebates(input): RebateResult[]` con `decimal.js`. Reutilizable en backend y frontend.

**Aceptación:**
- No importa nada de Nest, Astro ni React
- Recibe strings, devuelve strings (precisión decimal)
- 15+ tests Vitest cubren: cada nivel, fronteras, promedio ponderado, configuración vacía

**Dependencias:** —

---

## F1 · Ingesta

### F1.1 · Endpoint POST /uploads con Multer

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 (master flow) + sección 7.1
- **Módulo:** `apps/api/src/uploads/uploads.controller.ts`

Recibe multipart. Valida MIME (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Tamaño máx 50MB.

**Aceptación:**
- Rechaza archivos no-xlsx con 400 y mensaje claro
- Almacena temporalmente el archivo con un identificador
- Devuelve `{ uploadId, status: 'PENDING' }`

**Dependencias:** F0.3 (modelo Upload)

### F1.2 · Idempotencia por hash SHA-256

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** Empresarial + Innovación
- **FLOW ref:** sección 4.2 + sección 9.7
- **Módulo:** `apps/api/src/uploads/uploads.service.ts`

Calcula SHA-256 del archivo. Si ya existe `Upload{fileHash}`, devuelve ese sin reprocesar.

**Aceptación:**
- Subir el mismo Excel dos veces devuelve el mismo `uploadId`
- La respuesta incluye `wasDuplicate: true` cuando aplica
- Test e2e cubre el caso

**Dependencias:** F1.1

### F1.3 · ParseAgent — lectura de Pago QR

- **Prio:** P0 · **Esfuerzo:** L · **Premio:** Empresarial
- **FLOW ref:** sección 7.1 (parsing)
- **Módulo:** `apps/api/src/jobs/agents/parse.agent.ts`

Lee la hoja `Pago QR` con `exceljs` en modo streaming. Normaliza columnas: `Creado por`, `Número de Cuenta`, `Monto intercambio`, `Monto Pagado`, `Precio`, `Transacción Id`.

**Aceptación:**
- Procesa 5.325 filas reales en <8s
- Valida headers exactos del Excel real (incluyendo el espacio en `EXTRACTO DE PAGOS `)
- Filas inválidas se acumulan en `parseErrors[]` sin abortar
- Devuelve `ParseResult` tipado

**Dependencias:** F0.4

### F1.4 · ParseAgent — lectura de EXTRACTO DE PAGOS

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Innovación
- **FLOW ref:** sección 7.4 (conciliación)
- **Módulo:** mismo que F1.3

Lee la hoja `EXTRACTO DE PAGOS ` (con espacio al final). Headers: `Fecha`, `Hora`, `Codigo de transacción`, `Importe en bolivianos`. Filas empiezan en row 3 (offset).

**Aceptación:**
- Convierte `Importe en bolivianos` negativo a positivo (representa débito)
- Mapea `Codigo de transacción` ↔ `Transacción Id` del Pago QR
- 5.327 filas leídas correctamente

**Dependencias:** F1.3

### F1.5 · UploadDropzone island (React)

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** UI/UX
- **FLOW ref:** sección 7.1 + sección 10 (demo seg 10-30)
- **Módulo:** `frontend/src/islands/upload/UploadDropzone.tsx`

Drag & drop con `react-dropzone`. Validación cliente de extensión y tamaño. Preview de las primeras 20 filas con `xlsx` antes de enviar.

**Aceptación:**
- Hover muestra borde azul y `scale: 1.02`
- Preview detecta período por rango de fechas y lo muestra
- Botón "Procesar N filas" solo activo cuando hay archivo válido
- Muestra el conteo real ("5.325 transacciones de 239 usuarios")

**Dependencias:** F1.1

### F1.6 · Detección automática de período

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** UI/UX
- **FLOW ref:** sección 7.1
- **Módulo:** `packages/utils/src/period-detect.ts`

Dado un array de fechas, infiere el período principal (`YYYY-MM`) y advierte si el rango cruza meses.

**Aceptación:**
- Para los datos reales (abril-mayo 2025) devuelve advertencia "el archivo cubre 2 meses, ¿procesar como abril o mayo?"
- Modal de confirmación si la fracción menor supera el 10%

---

## F2 · Cálculo

### F2.1 · CRUD básico de tiers (sin UI)

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 7.2
- **Módulo:** `apps/api/src/tiers/tiers.service.ts`

Endpoints REST básicos sobre `CashbackTier`. Seed inicial con 5 niveles (Básico, Bronce, Plata, Oro, Platino).

**Aceptación:**
- `GET /tiers` lista los activos
- Seed cargado en `prisma seed`

### F2.2 · TierAgent — orquestación

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 (master flow)
- **Módulo:** `apps/api/src/jobs/agents/tier.agent.ts`

Carga tiers activos del período, agrupa transacciones por usuario, llama a `calculateRebates()` de `packages/utils`. Devuelve `RebateResult[]` sin persistir.

**Aceptación:**
- No escribe en DB
- Tests con dataset mock de 10 usuarios → resultados deterministas

**Dependencias:** F0.4, F2.1, F1.3

### F2.3 · Promedio ponderado de tipo de cambio

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** Innovación + Empresarial
- **FLOW ref:** sección 4.6 (innovación #5)
- **Módulo:** `packages/utils/src/tier-engine.ts`

Cálculo: `Σ(amountBOB × exchangeRate) / Σ(amountBOB)` por usuario.

**Aceptación:**
- Test específico con 3 transacciones a tasas distintas verifica el resultado
- El `RebateResult` incluye `avgExchangeRate` como string

**Dependencias:** F0.4

### F2.4 · Validación de exclusión mutua entre niveles

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 7.2 (configuración)
- **Módulo:** `apps/api/src/tiers/tier-validation.ts`

Dado un set de tiers, detecta solapamientos y huecos.

**Aceptación:**
- Devuelve `{ valid: true }` o `{ valid: false, conflicts: [...] }`
- Cubre: rangos solapados, huecos, max < min, % negativo
- Endpoint `POST /tiers/validate` lo expone

---

## F3 · Conciliación

### F3.1 · ReconcileAgent básico

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial + Innovación
- **FLOW ref:** sección 7.4
- **Módulo:** `apps/api/src/jobs/agents/reconcile.agent.ts`

JOIN por `transactionId`. Clasifica anomalías: `NO_EXTRACT`, `NO_QR`, `AMOUNT_MISMATCH`.

**Aceptación:**
- Procesa 5.325 + 5.327 filas en <5s
- Tolerancia configurable vía `RECONCILE_TOLERANCE_BOB` (default 0.01)
- Output: `Anomaly[]` con `transactionId`, `type`, `deltaBOB?`

**Dependencias:** F1.3, F1.4

### F3.2 · Persistencia de anomalías

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 8 (estados)
- **Módulo:** `apps/api/prisma/schema.prisma` + persistence agent

Modelo `Anomaly` con relación a `Upload` y `QRTransaction` opcional.

**Aceptación:**
- Cada anomalía referenciable desde la UI
- Estado `resolved: boolean` editable manualmente

**Dependencias:** F0.3, F3.1

### F3.3 · Endpoint de stats de anomalías

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** UI/UX
- **FLOW ref:** sección 7.4 + sección 10 (demo seg 60-100)
- **Módulo:** `apps/api/src/reconciliation/reconciliation.controller.ts`

`GET /reconciliation/stats?uploadId=X` devuelve conteo por tipo.

**Aceptación:**
- Respuesta: `{ NO_EXTRACT: n, NO_QR: m, AMOUNT_MISMATCH: k, total: t }`
- < 50ms con cache de respuesta

---

## F4 · Persistencia y workers

### F4.1 · BullMQ setup con Redis

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 (master flow)
- **Módulo:** `apps/api/src/jobs/bull.config.ts`

Configuración: 3 reintentos con backoff exponencial, concurrencia 1, removeOnComplete 100.

**Aceptación:**
- `process-upload` queue funcional
- Bull Board en `/admin/queues` (solo dev)

### F4.2 · ProcessUploadAgent (orquestador)

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5
- **Módulo:** `apps/api/src/jobs/process-upload.processor.ts`

Llama secuencialmente a Parse → Tier → Reconcile → Persistence. Emite eventos a cada paso.

**Aceptación:**
- Si cualquier agente falla, marca `Upload{FAILED}` con `errorMessage` claro
- Si todos OK, marca `Upload{DONE}` y emite `job:done`

**Dependencias:** F1.3, F1.4, F2.2, F3.1, F4.1, F4.3, F4.4

### F4.3 · PersistenceAgent transaccional

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 + sección 4.2 (audit trail)
- **Módulo:** `apps/api/src/jobs/agents/persistence.agent.ts`

`prisma.$transaction([...])` para insertar QRTransactions, MonthlyRebates, Anomalies, ParseErrors en una sola operación atómica.

**Aceptación:**
- Si falla en medio, no queda data parcial
- Idempotente: re-ejecutar limpia y reinserta

### F4.4 · EventsGateway WebSocket

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** UI/UX + Innovación
- **FLOW ref:** sección 5 + sección 10 (demo seg 30-60)
- **Módulo:** `apps/api/src/events/events.gateway.ts`

Socket.IO namespace `/jobs`. Emite `job:progress`, `job:done`, `job:failed`.

**Aceptación:**
- Cliente recibe los 4 eventos (5%, 45%, 80%, 95%, 100%)
- CORS abierto para `PUBLIC_API_URL` del frontend
- Reconexión automática si la conexión cae

---

## F5 · Visualización

### F5.1 · Layout base (AppShell)

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** UI/UX
- **FLOW ref:** sección 4.5
- **Módulo:** `frontend/src/layouts/AppShell.astro`

Sidebar 264px (desktop) / bottom nav (mobile) + topbar con período activo.

**Aceptación:**
- Responsive: desktop, tablet, mobile
- Navegación: Dashboard, Subir, Reintegros, Niveles, Conciliación, Simulador
- Período activo visible en topbar

### F5.2 · Dashboard ejecutivo

- **Prio:** P0 · **Esfuerzo:** L · **Premio:** UI/UX + Empresarial
- **FLOW ref:** sección 10 (demo seg 60-100)
- **Módulo:** `frontend/src/pages/index.astro` + `islands/dashboard/`

4 KPIs (Reintegrado, Usuarios, Ticket ⌀, Anomalías) + 2 gráficos (donut nivel, barras semana) + lista últimos uploads.

**Aceptación:**
- Counter animado en KPIs al montar
- Recharts `client:visible` para los gráficos
- Datos del último upload procesado se cargan en frontmatter Astro (sin flash)

**Dependencias:** F4.4, F2.2

### F5.3 · Tabla de reintegros (TanStack)

- **Prio:** P0 · **Esfuerzo:** L · **Premio:** UI/UX + Empresarial
- **FLOW ref:** sección 7.5 (auditoría)
- **Módulo:** `frontend/src/islands/rebates/RebatesTable.tsx`

Columnas: Usuario | Total BOB | Nivel (badge) | % | USDT | BOB | T/C ⌀ | Estado.
Sorting, filtros, paginación virtual.

**Aceptación:**
- Renderiza 1.000 filas sin lag perceptible (virtualización)
- Filtro de búsqueda por username
- Filtro por nivel
- Exportar selección a CSV
- Cifras monetarias en `font-mono tabular-nums`

**Dependencias:** F2.2

### F5.4 · Drawer detalle de usuario

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Empresarial + UI/UX
- **FLOW ref:** sección 7.5
- **Módulo:** `frontend/src/islands/rebates/UserDrawer.tsx`

Slide-in lateral con: resumen del usuario + lista de sus transacciones individuales + estado de conciliación por transacción.

**Aceptación:**
- Animación slide 250ms ease-in-out
- Cierre con ESC, clic fuera o botón X
- Cada transacción muestra ✓ si conciliada, ⚠ si anómala
- Click en transacción → modal con todos los campos crudos

**Dependencias:** F5.3, F3.2

### F5.5 · Panel de anomalías

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Innovación + Empresarial
- **FLOW ref:** sección 7.4
- **Módulo:** `frontend/src/islands/reconciliation/AnomalyPanel.tsx`

3 badges con conteos por tipo. Tabla filtrable. Botón "Explicar con IA" (F9.1).

**Aceptación:**
- Filtrar por tipo de anomalía
- Exportar a CSV
- Marcar manualmente como resuelta (con motivo)

**Dependencias:** F3.2, F3.3

---

## F6 · Reportes y exportación

### F6.1 · Generador de Excel de reintegros

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 (descargas)
- **Módulo:** `apps/api/src/reports/excel-report.service.ts`

`exceljs` produce un .xlsx con 4 hojas: Reintegros, Resumen por nivel, Anomalías, Errores de parseo.

**Aceptación:**
- Cabeceras con estilo (negrita, fondo azul Banexcoin)
- Cifras BOB con formato `#,##0.00`
- Cifras USDT con `#,##0.00000000`
- Footer con fecha de generación y hash del upload origen

**Dependencias:** F4.3

### F6.2 · Generador de archivo BanexTransfer

- **Prio:** P0 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 5 + sección 10 (demo seg 130)
- **Módulo:** `apps/api/src/reports/banex-transfer.service.ts`

Replica el formato de la hoja `Transfers` del Excel original. Columnas: `createdAt`, `transferNumber`, `amount`, `senderAccount.accountNumber`, `senderAccount.alias`, `product.symbol`, `receiverAccount.accountNumber`, `receiverAccount.alias`, `Tipo de servicio`, `oms.name`.

**Aceptación:**
- Una fila por `MonthlyRebate` con `tierId != null`
- `senderAccount` = cuenta tesorería configurable (env var)
- `product.symbol` = `USDT`
- `Tipo de servicio` = `S-005` (según hoja Servicios del Excel)
- Idempotente: regenerar mismo upload produce mismo archivo

**Dependencias:** F4.3

### F6.3 · Generador de Cuadre DEBE/HABER

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Empresarial + Innovación
- **FLOW ref:** sección 4.6 (innovación #6)
- **Módulo:** `apps/api/src/reports/balance-sheet.service.ts`

Replica la hoja `Saldos` del Excel original. Calcula DEBE (depósitos + cobros + reintegros) y HABER (pagos + retiros) por usuario.

**Aceptación:**
- Excel con: Usuario | DEBE | HABER | Saldo
- El saldo cuadra con el ejemplo del Excel original
- Demo: al lado del Excel original, las cifras coinciden

**Dependencias:** F4.3

### F6.4 · Endpoints de descarga

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 5
- **Módulo:** `apps/api/src/uploads/uploads.controller.ts`

- `GET /uploads/:id/report` → Excel reporte
- `GET /uploads/:id/banex-transfer` → archivo de transferencia
- `GET /uploads/:id/balance-sheet` → cuadre DEBE/HABER

**Aceptación:**
- Headers correctos (`Content-Disposition: attachment; filename=...`)
- Nombre incluye período: `BanexReintegra-Mayo2025-Reporte.xlsx`

---

## F7 · Configuración

### F7.1 · TiersEditor (UI)

- **Prio:** P1 · **Esfuerzo:** L · **Premio:** UI/UX + Empresarial
- **FLOW ref:** sección 7.2
- **Módulo:** `frontend/src/islands/tiers/TiersEditor.tsx`

CRUD con validación inline de F2.4. Modal para añadir/editar. Confirmación con período de aplicación.

**Aceptación:**
- Solapamientos se marcan en rojo en tiempo real
- Huecos se marcan en ámbar (warning, no bloquea)
- Guardar pide período de aplicación
- Historial visible (quién modificó qué y cuándo)

**Dependencias:** F2.1, F2.4

### F7.2 · Versionado de tiers

- **Prio:** P2 · **Esfuerzo:** M · **Premio:** Empresarial
- **FLOW ref:** sección 9.7
- **Módulo:** `apps/api/src/tiers/tiers.service.ts`

`validFrom` y `validTo` en `CashbackTier`. Tiers activos para un período son los que cumplen `validFrom <= period AND (validTo IS NULL OR validTo >= period)`.

**Aceptación:**
- Calcular reintegros usa los tiers vigentes al período del upload, no los actuales
- Test: cambiar un tier no afecta uploads procesados previamente

---

## F8 · Simulador what-if

### F8.1 · WhatIfSimulator island

- **Prio:** P1 · **Esfuerzo:** L · **Premio:** Innovación + UI/UX
- **FLOW ref:** sección 7.3 + sección 10 (demo seg 100-130)
- **Módulo:** `frontend/src/islands/simulator/WhatIfSimulator.tsx`

Two-panel: configuración con deslizadores + impacto en vivo (distribución + costo total). **Re-cálculo en el cliente.**

**Aceptación:**
- Mover un deslizador re-calcula 5.325 transacciones en <100ms
- Gráfico de distribución se actualiza sin parpadeo
- Comparativa contra config actual visible
- "Guardar como nueva configuración" redirige a `/tiers` con valores precargados

**Dependencias:** F0.4 (tier-engine puro), F5.2 (datos del último upload)

### F8.2 · Endpoint de transacciones cacheadas para simulación

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** Innovación
- **FLOW ref:** sección 7.3
- **Módulo:** `apps/api/src/uploads/uploads.controller.ts`

`GET /uploads/:id/transactions-minimal` devuelve solo los campos necesarios para simular: `userId`, `amountBOB`, `amountUSDT`, `exchangeRate`.

**Aceptación:**
- Respuesta gzip < 200KB para 5.325 transacciones
- Cache HTTP de 5 minutos

---

## F9 · IA (Claude)

### F9.1 · AnomalyExplainerAgent

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Innovación + Pitch
- **FLOW ref:** sección 4.6 (innovación #3) + sección 10 (demo seg 100-130)
- **Módulo:** `apps/api/src/reconciliation/anomaly-explainer.agent.ts`

Llama a Claude con un resumen agregado de las anomalías. Devuelve hipótesis en español.

**Aceptación:**
- Usa `claude-opus-4-7` o `claude-sonnet-4-6`
- Prompt incluye: conteos por tipo + distribución temporal + 5 ejemplos
- Respuesta en 2-3 oraciones, máximo 300 tokens
- Cache: misma combinación de anomalías → misma respuesta (hash del input)

**Dependencias:** F3.1

### F9.2 · Botón "Explicar con IA ✦" en panel

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** UI/UX + Pitch
- **FLOW ref:** sección 7.4
- **Módulo:** `frontend/src/islands/reconciliation/AnomalyPanel.tsx`

Botón visible. Estado de carga con spinner. Resultado en card animada que aparece debajo.

**Aceptación:**
- Loading state durante la llamada
- Error state si falla (timeout, sin API key)
- Texto aparece con fade-in 400ms

**Dependencias:** F9.1, F5.5

---

## F10 · Polish

### F10.1 · Animaciones Framer Motion

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** UI/UX
- **FLOW ref:** sección 10 (demo)
- **Módulo:** distribuido por islands

Implementar las animaciones documentadas en `design.md`:
- Layout morph upload → progreso → resultado
- Stagger fade-up de KPI cards
- Counter animado en cifras
- Slide del drawer lateral

**Aceptación:**
- Todas las transiciones <300ms
- `prefers-reduced-motion` respetado (sin animación si el usuario lo prefiere)

### F10.2 · Dark mode

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** UI/UX
- **FLOW ref:** sección 4.5
- **Módulo:** `frontend/src/components/ThemeToggle.tsx` + Tailwind config

Toggle en topbar. Preferencia en `localStorage`. Detección inicial vía `prefers-color-scheme`.

**Aceptación:**
- Toggle funcional, transición suave
- Todas las superficies usan tokens `--surface-*`
- No hay hardcoded `bg-white` ni `bg-gray-900`

### F10.3 · Microcopy en español profesional

- **Prio:** P1 · **Esfuerzo:** S · **Premio:** UI/UX + Pitch
- **FLOW ref:** sección 4.5
- **Módulo:** transversal

Revisar todos los textos: errores, tooltips, botones, vacíos. Tono profesional, sin "Oops" ni emojis dentro de la UI (los emojis solo aparecen en este documento y en el pitch oral).

**Aceptación:**
- Errores explican qué pasó y qué hacer
- Botones usan verbos en infinitivo: "Procesar", "Descargar"
- Mensajes de éxito son cortos: "Listo. 1.247 reintegros calculados."

### F10.4 · README + slides de pitch

- **Prio:** P1 · **Esfuerzo:** M · **Premio:** Pitch
- **FLOW ref:** sección 11
- **Módulo:** `README.md` + carpeta `pitch/`

README con: setup en 3 comandos, arquitectura en 1 párrafo, link al FLOW.md.
Slides: 6 diapositivas siguiendo el script de la sección 11 del FLOW.

**Aceptación:**
- `docker compose up && pnpm dev` funciona desde cero
- Slides exportadas como PDF en `pitch/BanexReintegra-Pitch.pdf`

### F10.5 · Datos de seed para demo confiable

- **Prio:** P0 · **Esfuerzo:** S · **Premio:** Pitch
- **FLOW ref:** sección 10
- **Módulo:** `apps/api/prisma/seed.ts`

Seed con 5 tiers + admin user. El Excel real se carga en la demo, no se hardcodea.

**Aceptación:**
- `pnpm seed` deja DB lista para demo
- Si algo falla, hay un `seed:demo` que pre-carga el upload del Excel real (fallback de pitch)

### F10.6 · Health checks y observabilidad mínima

- **Prio:** P2 · **Esfuerzo:** S · **Premio:** Empresarial
- **FLOW ref:** sección 13 (roadmap mes 1)
- **Módulo:** `apps/api/src/health/health.controller.ts`

`GET /health` con estado de Postgres, Redis y workers BullMQ.

**Aceptación:**
- Devuelve 200 si todo OK, 503 si algo cae
- Lista los componentes y su estado individual

---

## Matriz: features × categorías de premio

| Feature | Empresa | Social | Pitch | UI/UX | Innovación |
|---|:-:|:-:|:-:|:-:|:-:|
| F0.4 tier-engine puro | ● | | | | ● |
| F1.2 idempotencia SHA-256 | ● | | | | ● |
| F1.3 ParseAgent Pago QR | ● | | | | |
| F1.4 ParseAgent Extracto | | | | | ● |
| F1.5 UploadDropzone | | | ● | ● | |
| F2.3 promedio ponderado T/C | ● | | | | ● |
| F2.4 validación niveles | ● | | | | |
| F3.1 ReconcileAgent | ● | | ● | | ● |
| F4.3 PersistenceAgent | ● | | | | |
| F4.4 EventsGateway WS | | | ● | ● | ● |
| F5.2 Dashboard ejecutivo | ● | ● | ● | ● | |
| F5.3 Tabla TanStack | ● | | | ● | |
| F5.4 Drawer detalle | ● | | | ● | |
| F5.5 Panel anomalías | ● | | ● | ● | ● |
| F6.1 Excel reporte | ● | | | | |
| F6.2 BanexTransfer | ● | | ● | | |
| F6.3 Cuadre DEBE/HABER | ● | | ● | | ● |
| F7.1 TiersEditor | ● | | | ● | |
| F8.1 WhatIfSimulator | | | ● | ● | ● |
| F9.1 + F9.2 Claude IA | | | ● | ● | ● |
| F10.1 animaciones | | | | ● | |
| F10.2 dark mode | | | | ● | |
| F10.3 microcopy | | ● | ● | ● | |
| F10.4 pitch deck | | | ● | | |

---

## Roadmap por día

### Día 1 (cimientos + ingesta)

**Mañana (3h)** · F0.1, F0.2, F0.3, F0.4
**Tarde (5h)** · F1.1, F1.2, F1.3, F2.1, F4.1
**Noche (2h)** · F1.5, F5.1

**Salida del día 1:** se puede subir un Excel, se valida, se almacena, se ve preview. Backend tiene esqueleto.

### Día 2 (motor + visualización)

**Mañana (5h)** · F2.2, F2.3, F4.2, F4.3, F4.4
**Tarde (4h)** · F1.4, F3.1, F3.2, F3.3, F2.4
**Noche (3h)** · F5.2, F5.3, F6.1

**Salida del día 2:** flujo completo upload → procesar → ver tabla de reintegros. Reportes Excel descargables.

### Día 3 (diferenciadores + polish)

**Mañana (4h)** · F6.2, F6.3, F6.4, F5.4, F5.5
**Tarde (5h)** · F8.1, F8.2, F9.1, F9.2, F7.1
**Noche (3h)** · F10.1, F10.2, F10.3, F10.4, F10.5

**Salida del día 3:** producto demo-ready con todos los diferenciadores. Pitch listo.

---

## Definition of Done

Para considerar una feature terminada:

1. **Implementada** según los criterios de aceptación.
2. **Tipada** end-to-end (sin `any` excepto en límites externos justificados).
3. **Probada** manualmente con datos reales del Excel del enunciado.
4. **Tests automatizados** para `packages/utils` (no negociable). Para `apps/api`: tests donde la lógica lo justifique.
5. **Sin errores en consola** (front y back) al ejecutar el flujo principal.
6. **Documentada** si introduce un endpoint nuevo o cambia un contrato.
7. **Funciona dark mode** si toca UI.

---

## Features explícitamente fuera de scope

Para que el equipo no se distraiga:

- **Autenticación / autorización** — no la pide la ficha, no la implementamos en MVP.
- **Multi-tenant** — un solo cliente (Banexcoin).
- **API pública** — la API es interna del producto.
- **Integración directa con sistema Banexcoin** — la ficha lo prohíbe explícitamente.
- **Notificaciones por email** — no aporta a las categorías de premio.
- **Tests E2E con Playwright** — vale la pena en producción, no en 72h.
- **CI/CD completo** — deploy a Vercel/Railway manualmente es suficiente para demo.
- **Migración a producción real** — eso es roadmap post-hackathon (sección 13 del FLOW).
