# BanexReintegra — Skill Sheet

> **Anexo de [FLOW.md](FLOW.md)** — el flujo end-to-end del producto, la estrategia de premios y el pitch están en `FLOW.md`. Este documento cubre las decisiones técnicas y la planificación de las 72 horas.

---

## Qué es BanexReintegra

Sistema de cashback para Banexcoin Bolivia (cliente: **Lorena Alejandra Grundy Castaños**). Dado un Excel mensual con transacciones QR, calcula automáticamente el reintegro que le corresponde a cada usuario según el nivel de gasto, genera el archivo de BanexTransfer listo para ejecutar y detecta anomalías de conciliación contra el extracto bancario.

**Datos reales del período de prueba (abril-mayo 2025):** 5.325 transacciones, 239 usuarios únicos, Bs 1.023.899 (~73.921 USDT) de volumen total.

---

## Decisiones de stack y por qué

### NestJS sobre Spring Boot

| Criterio | NestJS | Spring Boot |
|---|---|---|
| Velocidad de iteración (72h) | ✅ TypeScript full-stack | ⚠️ Cambio de contexto Java ↔ TS |
| Tipos compartidos front↔back | ✅ Un paquete `@banex/types` | ⚠️ Duplicar o generar con OpenAPI |
| Parsing Excel/CSV | ✅ `exceljs` + `papaparse`, DX fluida | ⚠️ Apache POI, más boilerplate |
| Jobs asíncronos | ✅ BullMQ + Redis, casi cero config | ⚠️ Spring Batch o `@Async` + STOMP |
| Perfil del equipo | ✅ TypeScript en ambos lados | ❌ Curva adicional |
| Precisión decimal | ✅ `decimal.js` + `DECIMAL(20,8)` Postgres | ✅ `BigDecimal` nativo |

**Cuándo elegiría Spring Boot en su lugar:** sistema productivo con concurrencia transaccional alta, equipo con más fluidez en Java, SDK bancario obligatorio solo en Java.

### Astro + React Islands sobre Next.js

| Criterio | Astro + React Islands | Next.js 14 App Router |
|---|---|---|
| HTML inicial | ✅ Zero JS por defecto, solo hidrata islands | ⚠️ Hydration completa aunque no sea necesaria |
| Interactividad selectiva | ✅ `client:load` / `client:visible` por island | ⚠️ Client components se hidratan todos |
| Velocidad de build | ✅ Más rápido sin overhead de RSC | ⚠️ RSC añade complejidad en 72h |
| Dashboards con React | ✅ Componentes React normales como islands | ✅ Compatible |
| Complejidad de routing | ✅ File-based simple en `src/pages/` | ⚠️ App Router con layouts anidados |
| shadcn/ui | ✅ Funciona como island React | ✅ Compatible |

**Cuándo elegiría Next.js en su lugar:** app con mucho estado compartido entre rutas, SSR crítico, o muchas server actions.

### Monorepo Turborepo + pnpm

El `tier-engine` (núcleo del cálculo) vive en `packages/utils` como función pura. Esto permite:
- Testearlo con Vitest sin levantar Nest ni Postgres.
- Reutilizarlo en el frontend como island React para el **simulador what-if** (sin llamar al backend).
- Compartir los tipos DTO entre Astro y NestJS sin duplicar.

---

## Las 8 features que diferencian

### 1. Conciliación automática bidireccional
Cruza `Pago QR` (5.325 filas) con `EXTRACTO DE PAGOS` (5.327 filas) por `Transacción Id` ↔ `Codigo de transacción`.
La hoja `Servicios` del Excel lo pide explícitamente: *"hay algunos datos que no coinciden, la idea es tener la alerta de los que no coinciden"*.
Tres categorías: 🔴 sin extracto, 🟡 sin QR, 🟠 monto difiere (tolerancia ±Bs 0.01).

### 2. Idempotencia por hash SHA-256
Si el mismo archivo se sube dos veces, el sistema lo detecta y no duplica datos.
Demuestra madurez de ingeniería sin costo de implementación significativo.

### 3. Promedio ponderado de tipo de cambio
El tipo de cambio BOB/USDT varía transacción a transacción dentro del mes (en los datos reales: rango 13.20–15.63).
El reintegro en USDT se calcula con `Σ(amountBOB × rate) / Σ(amountBOB)` — no la tasa del día de pago.

### 4. Simulador what-if en el navegador
Deslizadores para ajustar rangos de niveles y ver en vivo:
- Cuántos de los 239 usuarios caen en cada nivel
- Costo total para tesorería en USDT y BOB
- Comparativa contra configuración actual
Re-cálculo de las 5.325 transacciones en <100ms, en el cliente, con `decimal.js`. **Cero llamadas al backend.**

### 5. Audit trail completo
Cada upload queda registrado con su hash. Cada `MonthlyRebate` tiene `paidOut` y `paidOutAt`.
Drilldown desde la tabla agregada hasta la transacción individual (`transactionId` único).
El archivo de BanexTransfer se regenera idempotentemente desde el estado guardado.

### 6. Validación de exclusión mutua entre niveles
Validación inline al editar: rangos no se solapan, no dejan huecos sin nivel. Versionado por `validFrom/validTo` para mantener histórico.

### 7. Cuadre DEBE/HABER (replicando la hoja `Saldos`)
El Excel original tiene una hoja `Saldos` con contabilidad de partida doble por usuario. Nuestro sistema **deriva automáticamente ese cuadre** y lo expone como reporte descargable. Demuestra que entendemos el modelo contable del cliente, no solo la fórmula del cashback.

### 8. Agente de IA para explicación de anomalías (Claude)
Botón "Explicar con IA ✦" en el panel de conciliación. Llama a Claude con un resumen de las anomalías y devuelve una hipótesis en lenguaje natural ("Las 23 transacciones sin extracto están concentradas en 12-15 de mayo, posible mantenimiento bancario").
Una sola llamada por sesión → bajo costo, alto impacto en demo.

---

## Planificación de 72 horas

### Día 1 — Cimientos (~10h)

**Mañana (3h)**
- Setup monorepo Turborepo + pnpm
- Docker Compose: Postgres + Redis
- Esqueleto NestJS: módulos `auth`, `uploads`, `tiers`, `rebates`, `reports`
- Esqueleto Astro con integración React + Tailwind + shadcn/ui + design tokens
- Prisma schema + primera migración

**Tarde (5h)**
- `POST /uploads` con multipart + validación MIME
- Parser Excel: hoja `Pago QR`, validar headers, normalizar filas, hash SHA-256
- Test unitario del parser con Excel de 10 filas

**Noche (2h)**
- UI de upload con `react-dropzone`
- Preview de primeras 20 filas con SheetJS antes de confirmar el envío
- Mensaje de confirmación: "Vas a procesar N transacciones del período YYYY-MM"

### Día 2 — Motor y UI principal (~12h)

**Mañana (5h)**
- `tier-engine` en `packages/utils`: función pura `calculateRebates(transactions, tiers) → RebateResult[]`
- Tests Vitest: 15+ casos (cada nivel, mes vacío, montos en frontera, tipo de cambio variable)
- Job BullMQ `process-upload`: parser → engine → persist
- WebSocket para progreso del job en tiempo real

**Tarde (4h)**
- CRUD de niveles (`/tiers`): crear, listar, editar, desactivar
- UI de niveles con validación visual de rangos (sin solapamiento)
- `GET /rebates?uploadId=X` con paginación y filtros

**Noche (3h)**
- Tabla principal TanStack Table: usuario | total BOB | nivel | reintegro USDT | reintegro BOB | tipo cambio promedio
- Sorting, filtros, paginación virtual para 1.000+ filas

### Día 3 — Reportes, polish y diferenciadores (~12h)

**Mañana (4h)**
- Generador de Excel con `exceljs`: hoja "Reintegros" + "Resumen por nivel" + "Anomalías"
- Generador del archivo BanexTransfer (columnas exactas del formato interno)
- Endpoints `GET /uploads/:id/report` y `GET /uploads/:id/banex-transfer`

**Tarde (5h)**
- Conciliación automática: cruzar `Pago QR` ↔ `EXTRACTO DE PAGOS`
- Simulador what-if con deslizadores (frontend puro, sin API)
- Dashboard ejecutivo: 4 KPIs + 2 gráficos Recharts

**Noche (3h)**
- Animaciones Framer Motion en el flujo upload → procesando → listo
- Dark mode (shadcn lo da gratis)
- README con arquitectura + slides de pitch

---

## Design system del dashboard

### Paleta de color (Banexcoin)

```css
--brand-primary:   #1A56DB;  /* azul Banexcoin */
--brand-secondary: #0E9F6E;  /* verde éxito / reintegro */
--warn-amber:      #F59E0B;
--alert-red:       #EF4444;
--surface-dark:    #111827;  /* dark mode base */
--surface-card:    #1F2937;
```

### Niveles de cashback — identidad visual

| Nivel | Color | Icono |
|---|---|---|
| Nivel 1 (Básico) | Gris plata `#94A3B8` | Shield |
| Nivel 2 (Bronce) | Bronce `#92400E` / `#D97706` | Shield Check |
| Nivel 3 (Plata) | Plata `#CBD5E1` | Star |
| Nivel 4 (Oro) | Oro `#EAB308` | Star Fill |
| Nivel 5 (Platino) | Platino `#818CF8` | Crown |

### Componentes clave

**KPI Card** — 4 en el dashboard ejecutivo
```
┌─────────────────────────┐
│ 🏷 Label                │
│                         │
│  $1,234.56 USDT    ▲12% │
│  vs mes anterior        │
└─────────────────────────┘
```

**Tabla de reintegros** — TanStack Table
- Columnas: Avatar | Usuario | Total BOB | Nivel (badge) | % Cashback | Reintegro USDT | Reintegro BOB | T/C promedio | Estado
- Acción por fila: "Ver detalle" (drawer lateral con todas las transacciones del usuario)
- Exportar selección como CSV

**Flujo de upload** — 3 estados con Framer Motion
```
[Dropzone vacío] → [Preview + confirmar] → [Barra progreso WebSocket] → [Resultado]
```

**Panel de anomalías** — badges coloreados
```
🔴 Sin extracto       23 registros
🟡 Sin pago QR         4 registros  
🟠 Monto no coincide   7 registros
```

### Tipografía y espaciado

Seguir la escala de shadcn/ui por defecto:
- Headings: `font-semibold tracking-tight`
- Datos monetarios: `font-mono tabular-nums` (para que los decimales se alineen en columnas)
- Labels de nivel: siempre con `Badge` + color semántico del nivel

---

## Cómo presentarlo (pitch de 3 minutos)

1. **Problema** (30s): "Hoy el equipo de Lorena tarda X horas en calcular a mano los reintegros en Excel. Con un error de fórmula, pierden dinero o tienen reclamos de usuarios."
2. **Demo** (90s): Subir el Excel real → ver la barra de progreso → tabla de resultados → descargar BanexTransfer → mostrar una anomalía detectada.
3. **Diferenciadores** (30s): Conciliación automática, simulador what-if, idempotencia, audit trail.
4. **Impacto** (30s): "Proceso que tardaba horas, ahora son 45 segundos. Cero errores de fórmula. Un clic para generar la transferencia."
