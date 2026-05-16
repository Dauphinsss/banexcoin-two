# BanexReintegra — Flujo Completo

> **Documento maestro.** Punto de entrada del proyecto. Cuenta la historia end-to-end: del problema real al pitch ganador. Los demás documentos son anexos técnicos a éste.
>
> - **Cliente:** Banexcoin Bolivia
> - **Representante:** Lorena Alejandra Grundy Castaños
> - **Período de datos analizados:** Abril – Mayo 2025
> - **Stack:** Astro + React Islands · NestJS · PostgreSQL · BullMQ · Prisma

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [El problema, en cifras reales](#2-el-problema-en-cifras-reales)
3. [Personas](#3-personas)
4. [Estrategia para ganar cada categoría](#4-estrategia-para-ganar-cada-categoría)
5. [Flujo end-to-end (master)](#5-flujo-end-to-end-master)
6. [User journey: antes vs después](#6-user-journey-antes-vs-después)
7. [Sub-flujos detallados](#7-sub-flujos-detallados)
8. [Estados del sistema](#8-estados-del-sistema)
9. [Casos borde y manejo de errores](#9-casos-borde-y-manejo-de-errores)
10. [Demo storyboard (3 minutos)](#10-demo-storyboard-3-minutos)
11. [Pitch script](#11-pitch-script)
12. [Métricas de impacto](#12-métricas-de-impacto)
13. [Roadmap post-hackathon](#13-roadmap-post-hackathon)
14. [Anexos: documentos relacionados](#14-anexos-documentos-relacionados)

---

## 1. Resumen ejecutivo

**BanexReintegra** automatiza el sistema de cashback en USDT que Banexcoin entrega mensualmente a los usuarios de pagos QR en Bolivia. Hoy el cálculo se hace a mano en Excel por un equipo reducido; nuestro sistema lo convierte en un proceso de **3 clics y 45 segundos**, con auditoría completa, detección automática de inconsistencias contra el extracto bancario y generación lista del archivo de transferencias masivas BanexTransfer.

**Una frase para el jurado:** *"Lo que hoy son 6 horas de Excel propensas a error, se convierten en 45 segundos verificables y trazables, escalando de 50 a 50.000 usuarios sin tocar el código."*

---

## 2. El problema, en cifras reales

Análisis del Excel `Reportes Banexcoin Bolivia Hackaton 2026.xlsx` (datos ficticios pero estructuralmente reales según indicación de Banexcoin):

| Métrica | Valor |
|---|---|
| Transacciones QR de pago en el período | **5.325** |
| Usuarios únicos beneficiables | **239** |
| Volumen total transado | **Bs 1.023.899** (~73.921 USDT) |
| Ticket promedio | Bs 192 |
| Transacciones promedio por usuario/mes | 22,3 |
| Diferencia QR vs Extracto bancario | 2 filas (5.327 vs 5.325) → **anomalías a detectar** |
| Hojas auxiliares relevantes | Pago QR, EXTRACTO DE PAGOS, Cobro QR, EXTRACTO DE COBROS, Transfers, Saldos, Servicios |

**Lo que descubrimos leyendo la hoja `Servicios`:**

> "En la columna se encuentra el Nro de Transacción que coincide con el extracto. **Hay algunos datos que no coinciden, la idea es tener la alerta de los que no coinciden.**"

Esto no es solo un Excel de cashback. Es un sistema de **conciliación financiera con detección de anomalías**. Esa frase, escondida en la hoja 7, es la clave para diferenciarse.

**El costo del problema actual (extrapolación):**

- 50 usuarios beneficiados hoy → 239 que ya deberían serlo solo en este mes
- A escala de Banexcoin (objetivo declarado: masivo), serían decenas de miles
- Cada hora de operación manual a tarifa de analista ≈ Bs 60-100
- Un solo error de fórmula (visto en el sector financiero) puede costar 100x el ahorro

---

## 3. Personas

### Persona 1 — Lorena (Representante Banexcoin) · usuaria operativa

- **Rol:** ejecuta los reintegros mensuales hoy a mano
- **Dolor:** lentitud, posibilidad de error, presión de escalar
- **Necesita:** subir el Excel, revisar resultados, descargar el archivo de transferencia, dormir tranquila
- **Mide éxito en:** tiempo total + cero errores

### Persona 2 — Auditor / Contador · usuario de verificación

- **Rol:** verifica que los reintegros sean correctos antes de ejecutar la transferencia
- **Dolor:** hoy depende de "confiar en la fórmula" del Excel manual
- **Necesita:** trazabilidad por transacción, capacidad de explicar cada decimal
- **Mide éxito en:** poder auditar cualquier reintegro hasta su transacción origen

### Persona 3 — Usuario final QR (beneficiario) · indirecto

- **Rol:** paga con QR usando Banexcoin; recibe cashback en USDT
- **Dolor:** hoy es invisible — no sabe cuándo le pagan, cuánto, ni por qué
- **Necesita:** transparencia y previsibilidad
- **Mide éxito en:** confianza en la marca

> El producto principal sirve a Lorena, pero su impacto social llega al usuario final QR — base del argumento de **Mejor Solución Social**.

---

## 4. Estrategia para ganar cada categoría

La slide del hackathon define 5 categorías. Cada una requiere un mensaje específico **respaldado por una feature concreta** del producto.

### 4.1 Gran Premio (USD 5.000 + aceleración 3 meses)

**Mensaje:** "Resuelve un problema real, presentado por la empresa, con una solución que pueden poner en producción mañana."

**Cómo lo defendemos:**
- Solución 100% alineada con el brief (lectura literal de la ficha técnica)
- 100% independiente del sistema actual de Banexcoin (requisito explícito)
- Stack mainstream y mantenible (NestJS + Astro + Postgres)
- Demo en vivo con el Excel real del enunciado

### 4.2 Mejor Solución Empresarial

**Mensaje:** "ROI inmediato, audit trail completo, escalable de 239 a 50.000 usuarios sin reescribir nada."

**Features que lo demuestran:**
- **Idempotencia SHA-256** del archivo — subir dos veces el mismo Excel no duplica
- **Audit trail** en `MonthlyRebate` con `paidOut`, `paidOutAt` y trazabilidad por transacción
- **Conciliación automática** contra extracto bancario (compliance-ready)
- **Tipo de cambio histórico auditado** derivado de `Monto Pagado / Monto intercambio`
- **Decimales DECIMAL(20,8)** — nunca `float`, nunca redondeo silencioso

### 4.3 Mejor Solución Social

**Mensaje:** "Bolivia tiene una economía mayoritariamente en efectivo. Premiar el uso de QR es premiar la inclusión financiera, la trazabilidad y el ahorro en activos estables."

**Features que lo demuestran:**
- Acelera el rollout del cashback de 50 a **todos** los usuarios elegibles
- Cada cashback es transparente y verificable por el usuario final
- Reduce barrera de entrada al ahorro en USDT para población no bancarizada
- En el dashboard incluimos un **vista pública opcional** que muestra al usuario final cuánto recibió y por qué (transparencia → confianza → adopción)

### 4.4 Mejor Pitch

**Mensaje:** historia clara, demo memorable, cifra impactante.

**Estructura:** ver sección [11. Pitch script](#11-pitch-script).
- Arco narrativo: dolor → demo → cifra → cierre
- Demo en vivo de 90 segundos con el Excel real
- Una sola cifra repetida tres veces: **"45 segundos"**
- Cierre que el jurado recuerda: *"Esto ya está corriendo. Mañana lo pueden enchufar."*

### 4.5 Mejor UI/UX

**Mensaje:** producto que un operador no-técnico usa sin entrenamiento.

**Features que lo demuestran:**
- **Preview del Excel** antes de procesar (genera confianza)
- **Progreso en tiempo real por WebSocket** (reduce ansiedad)
- **Drawer de detalle** que va de la tabla agregada a la transacción atómica en un clic
- **Microcopy en español** profesional, sin tecnicismos
- **Dark mode**, **animaciones Framer Motion** suaves (<300ms)
- **Tipografía monoespaciada en cifras** (alineación perfecta de decimales)
- **Estados de error explicativos** con propuesta de acción, no códigos crípticos

### 4.6 Mejor Innovación Tecnológica

**Mensaje:** "No es un CRUD. Hay 6 ideas técnicas que ningún equipo va a tener."

**Las 6 ideas:**
1. **Conciliación bidireccional** Pago QR ↔ Extracto bancario con tolerancia configurable
2. **Simulador what-if** que recalcula 5.325 transacciones **en el navegador** con `decimal.js` (sin tocar API) — el `tier-engine` es la misma función pura usada en backend y frontend
3. **Agente Claude** que explica anomalías en lenguaje natural ("Detecté 23 transacciones sin extracto, todas del 12-15 de mayo, posiblemente por mantenimiento bancario")
4. **Idempotencia por hash SHA-256** — operación segura contra reintentos
5. **Tipo de cambio histórico auditado** intra-mes, deducido desde los montos reales del Excel
6. **Cuadre DEBE/HABER por usuario** derivado automáticamente desde el Excel, replicando la hoja `Saldos` (demostramos que entendemos el modelo contable del cliente)

---

## 5. Flujo end-to-end (master)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   PERSONA       PANTALLA         ACCIÓN             SISTEMA          OUTPUT  │
│                                                                              │
│   Lorena   →  Dashboard      Clic "Subir Excel"                              │
│      │                                                                       │
│      ▼                                                                       │
│            Upload Page       Drag & drop Excel                               │
│      │                       (.xlsx, max 50MB)                               │
│      ▼                                                                       │
│            Preview           Confirma 5.325                                  │
│                              filas y período                                 │
│      │                                                                       │
│      ▼                                                                       │
│            ────────────►  POST /uploads ──►   Valida MIME                    │
│                                                Calcula SHA-256               │
│                                                ┌─ Hash ya existe? ─┐         │
│                                                ▼                   ▼         │
│                                            Devuelve              Crea       │
│                                            upload                Upload     │
│                                            existente             {PENDING}  │
│                                            (idempotencia)        │           │
│                                                                  ▼           │
│                                                          Encola BullMQ      │
│                                                                  │           │
│                                                                  ▼           │
│            Progress UI  ◄── WebSocket ──   ProcessUploadAgent               │
│            (ws live)                              │                          │
│                                                   ├─► ParseAgent             │
│                                                   │   (lee Pago QR +         │
│                                                   │    Extracto)             │
│                                                   │                          │
│                                                   ├─► TierAgent              │
│                                                   │   (aplica tier-engine    │
│                                                   │    con consumo BOB       │
│                                                   │    + USDT histórico)     │
│                                                   │                          │
│                                                   ├─► ReconcileAgent         │
│                                                   │   (cruza por             │
│                                                   │    transactionId)        │
│                                                   │                          │
│                                                   └─► PersistenceAgent       │
│                                                       (Prisma transaction)   │
│      ▼                                                                       │
│            Results View      Ve KPIs:                                        │
│                              · 239 usuarios beneficiados                     │
│                              · 1.847 USDT a reintegrar                       │
│                              · 2 anomalías detectadas                        │
│                                                                              │
│            ┌──────────────┬──────────────┬──────────────┐                    │
│            │              │              │              │                    │
│            ▼              ▼              ▼              ▼                    │
│      Tabla Rebates  Panel Anomalías  Simulador     Descargas                 │
│      (drilldown)    (con "Explicar   What-if      ┌────────────────┐         │
│                      con IA ✦")     (sliders)    │ Excel reporte  │         │
│                                                  │ BanexTransfer  │         │
│                                                  │ Cuadre DEBE/    │         │
│                                                  │   HABER         │         │
│                                                  └────────────────┘         │
│      │                                                  │                    │
│      └──────────►  Lorena revisa, audita, descarga ◄───┘                    │
│                                                                              │
│                              │                                               │
│                              ▼                                               │
│                  Carga BanexTransfer en sistema Banexcoin                    │
│                  (fuera de nuestro scope — diseño 100% independiente)        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Tiempos objetivo end-to-end** (para 5.325 transacciones):

| Etapa | Tiempo | Quién lo experimenta |
|---|---|---|
| Drag & drop + preview | 5s | Lorena |
| POST upload + validación | <1s | Sistema |
| Parsing del Excel | 8s | Worker |
| Cálculo tier-engine | 3s | Worker |
| Conciliación | 5s | Worker |
| Persistencia | 4s | Worker |
| **Total visible para Lorena** | **~25s** | Lorena |
| Revisión + descarga | 20s | Lorena |
| **Total proceso completo** | **~45s** | Lorena |

---

## 6. User journey: antes vs después

### Antes (estado actual según ficha técnica)

```
Día 1, 09:00  Lorena abre Excel del mes
Día 1, 09:30  Limpia datos manualmente (5.000+ filas)
Día 1, 11:00  Aplica fórmulas SUMIF por usuario
Día 1, 14:00  Clasifica usuarios por nivel (a mano)
Día 1, 16:00  Calcula reintegros USDT con tasa "del día"
Día 1, 17:30  Construye archivo de transferencia
Día 2, 09:00  Detecta error de fórmula en 3 filas → recálculo
Día 2, 11:00  Verifica con extracto bancario (parcialmente)
Día 2, 14:00  Sube transferencia al sistema
                                ___________________________
                                Total: ~6 horas en 2 días
                                Cobertura: ~50 usuarios
                                Riesgo: alto (errores manuales)
```

### Después (con BanexReintegra)

```
Día 1, 09:00  Lorena entra al dashboard
Día 1, 09:00  Drag & drop del Excel
Día 1, 09:00  Confirma preview de 5.325 transacciones
Día 1, 09:00  Espera 25s mientras procesa (WebSocket en vivo)
Día 1, 09:01  Revisa KPIs y 2 anomalías detectadas
Día 1, 09:02  Lee explicación IA de las anomalías
Día 1, 09:03  Descarga Excel auditable + archivo BanexTransfer
Día 1, 09:03  Carga BanexTransfer en sistema Banexcoin
                                ___________________________
                                Total: 3 minutos
                                Cobertura: 239 usuarios (todos)
                                Riesgo: bajo (validaciones automáticas)
                                Ahorro: 5h 57min por mes · 4.8x usuarios
```

**Reducción de 360 minutos a 3 minutos = mejora de 120x.**

---

## 7. Sub-flujos detallados

### 7.1 Flujo principal: procesar el mes

```
START
  │
  ▼
[Lorena entra a /]
  │
  ▼
[Ve dashboard del último período procesado]
  │
  ▼
[Clic en "Subir Excel"] ──────────────────────────────►  Estado: navegando
  │
  ▼
[Pantalla /uploads/new — Dropzone vacío]
  │
  ▼
[Drag & drop archivo .xlsx]
  │
  ▼
[Sistema lee primeras 20 filas y muestra preview]
  │
  ├─ Headers no coinciden → muestra error con columnas faltantes
  │
  ▼
[Confirma: "Procesar 5.325 filas del período abril-mayo 2025"]
  │
  ▼
[POST /uploads con archivo + período]
  │
  ▼
[Sistema calcula SHA-256]
  │
  ├─ Hash ya existe en DB → muestra "Este archivo ya fue procesado el 14/05 a las 10:23"
  │                          ofrece "Ver resultados" o "Cancelar"
  ▼
[Crea Upload{PENDING}, encola job en BullMQ, devuelve uploadId]
  │
  ▼
[Frontend abre conexión Socket.IO al namespace /jobs]
  │
  ▼
[Recibe job:progress eventos: 5%, 30%, 65%, 90%, 100%]
  │
  ▼
[Al recibir job:done → navega a /uploads/:id]
  │
  ▼
[Resultados: 4 KPIs + 2 gráficos + tabla + panel de anomalías]
  │
  ├─► [Drawer detalle por usuario]    ──► [Ver transacciones individuales]
  ├─► [Panel anomalías]                ──► [Explicar con IA]
  ├─► [Simulador what-if]              ──► [Ajustar niveles antes de descargar]
  └─► [Botones de descarga]
        │
        ├─► Excel reporte completo (4 hojas)
        ├─► Archivo BanexTransfer (CSV/Excel formato interno)
        └─► Cuadre DEBE/HABER (replicando hoja Saldos del Excel original)
  │
  ▼
END (Lorena descarga BanexTransfer y lo carga en sistema Banexcoin)
```

### 7.2 Flujo de configuración de niveles

```
[Lorena entra a /tiers]
  │
  ▼
[Ve lista actual de niveles activos]
  │
  │   Nivel 1 · Básico    Bs 0    – Bs 500     1.00%
  │   Nivel 2 · Bronce    Bs 501  – Bs 1.000   1.50%
  │   Nivel 3 · Plata     Bs 1.001 – Bs 2.500  2.00%
  │   Nivel 4 · Oro       Bs 2.501 – Bs 5.000  2.50%
  │   Nivel 5 · Platino   Bs 5.001 – ∞         3.00%
  │
  ▼
[Edita un rango]
  │
  ├─ Solapamiento detectado → badge rojo inline, guardar bloqueado
  ├─ Hueco entre rangos    → badge ámbar (warning, no bloquea)
  └─ Validación OK         → guardar habilitado
  │
  ▼
[Confirma: "¿Aplicar a partir de qué período?"]
  │
  ▼
[Sistema versiona los tiers con validFrom/validTo]
  │
  ▼
[Histórico de cambios queda registrado]
```

### 7.3 Flujo del simulador what-if (corre en el navegador)

```
[Lorena entra a /simulator]
  │
  ▼
[Sistema carga el último upload procesado + tiers actuales]
  │
  ▼
[Dos paneles: Configuración | Impacto en vivo]
  │
  ▼
[Mueve un deslizador del rango Nivel 3]
  │
  ▼
[Island React (WhatIfSimulator.tsx) llama a calculateRebates() de packages/utils]
  │   ↳ exactamente la misma función pura que usa el backend
  │
  ▼
[Re-calcula 5.325 transacciones en <100ms en el navegador]
  │
  ▼
[Actualiza gráfico de distribución y costo total]
  │
  ▼
[Lorena ve: "Si subo el % del Nivel 4 a 3%, cuesta 312 USDT extra"]
  │
  ▼
[Opcional: "Guardar como nueva configuración" → redirige a /tiers]
```

### 7.4 Flujo de conciliación

```
[Sistema durante el procesamiento]
  │
  ▼
[ReconcileAgent ejecuta JOIN entre Pago QR y EXTRACTO DE PAGOS]
  │   por columna "Transacción Id" / "Codigo de transacción"
  │
  ▼
[Para cada transactionId en QR:]
  │
  ├─ No está en extracto         → Anomaly{ NO_EXTRACT } 🔴
  ├─ Está pero monto difiere     → Anomaly{ AMOUNT_MISMATCH, delta } 🟠
  │   (tolerancia: ±Bs 0.01 configurable)
  └─ Está y monto coincide       → ✅ reconciledWithExtract = true
  │
  ▼
[Para cada transactionId en extracto que no esté en QR:]
  │
  └─ Anomaly{ NO_QR } 🟡 (posible cobro o transferencia, no pago)
  │
  ▼
[En el panel de anomalías:]
  │
  ├─► Lista filtrable por tipo
  ├─► Click en una anomalía → contexto (fecha, usuario, monto)
  └─► Botón "Explicar con IA ✦" → llama a Claude
        │
        ▼
   [Claude recibe resumen agregado y devuelve:]
   "Detecté 23 transacciones del 12-15 de mayo sin contraparte en el
    extracto bancario. Por la concentración temporal, podría tratarse
    de un período de mantenimiento del banco emisor del extracto.
    Recomendación: contrastar con la fecha del último corte bancario
    antes de aprobar reintegros de ese período."
```

### 7.5 Flujo de auditoría (drilldown)

```
[Auditor entra a /rebates?uploadId=X]
  │
  ▼
[Ve tabla agregada: 239 usuarios con sus reintegros]
  │
  ▼
[Click en fila de "AdrianaFlores30Bo" — Bs 25.895 → Oro · 2.5%]
  │
  ▼
[Drawer lateral con:]
  │   - Total spent: Bs 25.895,01
  │   - Tier asignado: Oro (2.5%)
  │   - Rebate USDT: 46.69
  │   - Rebate BOB: 647.38
  │   - T/C histórico auditado: 13.8636
  │   - 187 transacciones individuales (tabla)
  │
  ▼
[Click en una transacción específica]
  │
  ▼
[Modal con detalle completo:]
  │   - transactionId: 207681530
  │   - Fecha: 15/04/2025 09:01:55
  │   - Monto BOB: 5.00
  │   - Monto USDT: 0.378
  │   - Tipo cambio aplicado: 13.2065
  │   - Comisión: 0.03
  │   - ✓ Conciliado con extracto bancario (línea 2, monto -5)
```

---

## 8. Estados del sistema

| Estado | Trigger | UI | Backend |
|---|---|---|---|
| `IDLE` | Inicio | Dropzone vacío | — |
| `UPLOADING` | POST /uploads | Spinner + barra HTTP | Multer recibiendo |
| `VALIDATING` | Tras upload completo | "Validando archivo..." | SHA-256 + headers check |
| `DUPLICATE` | Hash existe | Modal "Ya procesado el X" | Sin crear nuevo Upload |
| `QUEUED` | Job encolado | "En cola..." | Upload{PENDING} en BullMQ |
| `PROCESSING` | Worker activo | Barra de progreso WS (5%→100%) | Agentes corriendo |
| `DONE` | job:done | Card de resultado + CTA "Ver" | Upload{DONE}, datos persistidos |
| `FAILED` | job:failed | Card de error + "Reintentar" | Upload{FAILED}, log preservado |
| `RECONCILED` | Por anomalía resuelta manualmente | Badge verde | Anomaly{resolved:true} |
| `PAID_OUT` | Tras clic "Marcar como pagado" | Badge "✓ Pagado el DD/MM" | MonthlyRebate{paidOut:true} |

---

## 9. Casos borde y manejo de errores

### 9.1 Archivo corrupto o no es Excel

- Validar MIME server-side
- Mensaje: *"El archivo no es un Excel válido. Asegúrate de exportarlo en formato .xlsx, no .xls ni .csv."*

### 9.2 Headers no coinciden

- Lista exacta de columnas faltantes
- Sugerencia: *"¿Estás subiendo la hoja correcta? Esperamos las columnas: Creado por, Número de Cuenta, Monto Pagado, Precio, Transacción Id."*

### 9.3 Mes incompleto / sin transacciones

- Detectar período por rango de fechas en `Fecha de creación`
- Si <10 transacciones: warning "Solo encontré N transacciones — ¿es correcto?"

### 9.4 Usuario sin nivel (gasto < mínimo del Nivel 1)

- Persistir `MonthlyRebate` con `tierId: null` y `rebatePercent: 0`
- En la tabla: badge gris "Sin nivel" en lugar de ocultar
- Auditable: queda registro de que se procesó y no aplicó

### 9.5 Tipo de cambio inconsistente

- Si una transacción tiene `Precio: 0` o negativo → anomalía bloqueante
- Persistir pero no incluir en cálculo de tipo de cambio auditado ni reintegro
- Reporte de anomalías incluye estas filas como tipo `INVALID_RATE`

### 9.6 Reintento de job fallido

- BullMQ reintenta 3 veces con backoff exponencial
- Si los 3 fallan: Upload{FAILED} con `errorMessage` detallado
- UI ofrece botón "Reintentar" que re-encola sin pedir el archivo de nuevo (ya está en almacenamiento temporal con su hash)

### 9.7 Conflicto de período

- Si ya existe un `Upload{DONE}` para el mismo `period`, modal:
  *"Ya hay un reintegro calculado para abril 2025. ¿Quieres reemplazarlo o cancelar?"*
- Reemplazo: marca el anterior como `SUPERSEDED`, mantiene historial

### 9.8 Reintegro ya marcado como pagado

- No permitir reprocesar un período cuyos `MonthlyRebate` tienen `paidOut: true`
- Mensaje claro: *"23 reintegros de este período ya fueron pagados. Para corregir, contacta soporte."*

---

## 10. Demo storyboard (3 minutos)

> Cada segundo de la demo está pensado para una categoría de premio.

### Segundo 0–10 · Contexto (Empresarial + Pitch)

> "Buenos días. Soy [tú]. Lorena, de Banexcoin, hoy tarda 6 horas calculando manualmente reintegros para 50 usuarios. En este mes, deberían haber sido 239. Vamos a procesar **los 239 en 45 segundos**."

→ Pantalla: dashboard limpio con período mayo 2025 vacío.

### Segundo 10–30 · Upload (UI/UX)

→ Drag & drop del Excel real de Banexcoin sobre el dropzone.

→ Preview aparece con animación: *"Detecté 5.325 transacciones de 239 usuarios. Período: abril–mayo 2025."*

→ Clic en "Procesar".

### Segundo 30–60 · Procesamiento en vivo (Innovación)

→ Barra de progreso WebSocket, etiquetas cambiando:
- "Leyendo archivo..."
- "Calculando reintegros..."
- "Conciliando con extracto bancario..." ← *pausa para enfatizar*
- "Listo."

> "Cruzamos cada pago QR con el extracto bancario. Esto no estaba en el brief — lo descubrimos leyendo la hoja Servicios del Excel."

### Segundo 60–100 · Resultados (Empresarial + Social)

→ KPIs aparecen con counter animado:
- **1.847 USDT a reintegrar**
- **239 usuarios beneficiados**
- **2 anomalías detectadas**

→ Clic en el usuario más activo. Drawer lateral. Trazabilidad hasta la transacción individual.

> "Cada reintegro es auditable hasta la transacción atómica. Cumple compliance financiero de día uno."

### Segundo 100–130 · Innovación tecnológica destacada

→ Clic en "Explicar con IA ✦" en el panel de anomalías.

→ Claude responde en pantalla con texto plausible.

→ Cambio a Simulador. Mover un deslizador. Gráfico se actualiza en vivo.

> "Esto está corriendo en tu navegador. Cero llamadas al servidor. Banexcoin puede simular ajustes de política antes de comprometerlos."

### Segundo 130–160 · Descarga + cierre (Pitch + Social)

→ Clic en "Descargar BanexTransfer". El archivo cae con el formato exacto que Banexcoin necesita.

→ Pantalla final con 3 bullets:

> - **Antes:** 6 horas, 50 usuarios, riesgo de error
> - **Después:** 45 segundos, 239 usuarios, audit trail completo
> - **Próximo mes en Banexcoin:** miles de bolivianos ahorrando en USDT con un cashback transparente

> "Esto no es un prototipo. Está dockerizado, testeado, y se despliega en Vercel + Railway en 5 minutos. Mañana lo pueden enchufar. Gracias."

---

## 11. Pitch script

### Hook (15s)

> "Bolivia paga el 87% de sus compras en efectivo. Banexcoin está cambiando eso con pagos QR que ahorran al usuario en USDT. Pero hay un cuello de botella: el cashback que premia ese cambio se calcula a mano, en Excel, para apenas 50 usuarios. Hoy se los desenchufamos."

### Problema (30s)

> "Esta es la ficha de Banexcoin. La leímos completa. El brief pide cuatro cosas: cargar Excel, calcular niveles, generar reportes, preparar BanexTransfer. Eso lo hace cualquiera. Lo que el brief no dice explícitamente — pero está escondido en la hoja Servicios del Excel — es que **los datos no siempre coinciden con el extracto bancario**. Sin detección de anomalías, esto es un sistema que paga reintegros que no deberían pagarse."

### Solución (45s)

> "BanexReintegra hace las cuatro cosas del brief y dos más:
> 1. Carga del Excel con preview e idempotencia por hash
> 2. Cálculo automático por niveles con tipo de cambio histórico auditado
> 3. Reportes en Excel y BanexTransfer listos para ejecutar
> 4. Cuadre DEBE/HABER replicando la hoja Saldos
> 5. **Conciliación automática contra el extracto bancario**
> 6. **Simulador what-if** para ajustar políticas sin riesgo
>
> Todo independiente del sistema actual de Banexcoin, como pide la ficha."

### Demo (90s)

→ Ver sección [10. Demo storyboard](#10-demo-storyboard-3-minutos).

### Cierre (15s)

> "**6 horas a 45 segundos. 50 usuarios a 239. Cero errores manuales.** Banexcoin nos pidió un sistema que minimice errores humanos y sea escalable. Aquí está. Está dockerizado, está testeado, y mañana lo pueden poner en producción. Gracias."

---

## 12. Métricas de impacto

### Para Banexcoin (cuantitativas)

| Métrica | Antes | Después | Mejora |
|---|---|---|---|
| Tiempo por procesamiento mensual | 360 min | 3 min | 120x |
| Usuarios cubiertos | 50 | 239 (escalable a 50.000) | 4,8x → ∞ |
| Tasa de error humano | desconocida | 0 (validaciones automáticas) | — |
| Trazabilidad por reintegro | limitada | 100% hasta la transacción | — |
| Anomalías detectadas pre-pago | 0 (manual) | automático | — |

### Para el usuario final QR (cualitativas)

- Recibe cashback transparente y verificable
- Confianza en la marca → más adopción QR → más volumen para Banexcoin
- Ciclo virtuoso de inclusión financiera

### Para el ecosistema boliviano (impacto social)

- Acelera migración de efectivo a digital
- Genera capa de trazabilidad financiera en una economía mayoritariamente informal
- Modelo replicable para otras instituciones del país

---

## 13. Roadmap post-hackathon

> Lo que diríamos si el jurado pregunta "¿qué viene después?"

### Mes 1 — Puesta en producción

- Integrar autenticación corporativa (SSO de Banexcoin)
- Roles: Operador (Lorena), Auditor (solo lectura), Admin (config tiers)
- Logs estructurados y observabilidad (Sentry + Grafana)

### Mes 2 — Vista pública para usuarios finales

- Portal `mi.banexcoin.com.bo/cashback` donde cada usuario ve su histórico
- Estimador en vivo: "Si gastas Bs X más este mes, subes a Nivel Y"
- Notificación cuando el reintegro se acredita

### Mes 3 — Inteligencia de negocio

- Cohorts: ¿qué usuarios consumen más al subir de nivel?
- Recomendaciones de niveles óptimos según objetivos (volumen vs retención)
- Integración API directa con el core de Banexcoin (ya no manual)

### Mes 6 — Producto white-label

- Otras exchanges latinoamericanas con el mismo problema
- Argentina, Perú, Colombia tienen estructura QR similar
- BanexReintegra como SaaS para fintechs regionales

---

## 14. Anexos: documentos relacionados

| Documento | Propósito |
|---|---|
| [FEATURES.md](FEATURES.md) | Backlog descompuesto por etapas del flow: 50+ features con prioridad, esfuerzo y categoría de premio que sirven. Punto de entrada para implementar. |
| [SKILL.md](SKILL.md) | Decisiones de stack y planificación de 72 horas |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Estructura técnica detallada del monorepo, modelo de datos, API REST |
| [agents.md](agents.md) | Mapa de los agentes backend (BullMQ workers, EventsGateway, AnomalyExplainerAgent con Claude) |
| [design.md](design.md) | Sistema de diseño completo: tokens, componentes, pantallas, modelo de islands Astro |

**Regla de oro:** si algo de los anexos contradice este FLOW.md, gana FLOW.md y se actualiza el anexo.
