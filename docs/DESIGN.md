# BanexReintegra - Design

> **Anexo de [FLOW.md](FLOW.md).** El user journey, casos borde y estrategia para "Mejor UI/UX" están en `FLOW.md`. Este documento define el sistema de diseño concreto: tokens, componentes, pantallas y el modelo de islands de Astro.

Sistema de diseño y experiencia para una herramienta operativa de Banexcoin Bolivia. El producto debe permitir cargar reportes mensuales de pagos QR, calcular reintegros en USDT/Bs., detectar inconsistencias y generar archivos listos para BanexTransfer sin integrarse directamente al core actual de Banexcoin.

---

## Principios de producto

1. **Operativo antes que decorativo.** Cada pantalla debe reducir trabajo manual, evitar errores de Excel y dejar claro qué acción sigue.
2. **Confianza financiera.** Montos, tipos de cambio, porcentajes y estados deben verse verificables. Nada de cifras ambiguas ni redondeos escondidos.
3. **Independiente por diseño.** El usuario trabaja con archivos cargados manualmente. La interfaz nunca debe sugerir conexión directa con sistemas internos de Banexcoin.
4. **Auditable.** Cada upload, cálculo, anomalía y archivo exportado debe poder rastrearse por período, usuario y fuente.
5. **Escalable para lotes masivos.** La UX debe soportar miles de filas con búsqueda, filtros, virtualización y estados de procesamiento claros.

---

## Dirección visual

La estética recomendada es **terminal financiero premium**: fondo oscuro sobrio, superficies con baja saturación, acentos Banexcoin en azul y verde, tablas densas pero legibles y microinteracciones precisas. Debe sentirse como una mesa de control de tesorería, no como un dashboard genérico de SaaS.

### Paleta

```css
:root {
  /* Marca */
  --banex-blue-50: #eaf2ff;
  --banex-blue-100: #cfe2ff;
  --banex-blue-500: #1a56db;
  --banex-blue-600: #1648b8;
  --banex-blue-700: #12398f;

  /* Reintegro / exito */
  --cash-green-50: #eafaf3;
  --cash-green-500: #0e9f6e;
  --cash-green-600: #057a55;

  /* Anomalias */
  --risk-red-500: #ef4444;
  --risk-amber-500: #f59e0b;
  --risk-orange-500: #f97316;

  /* Superficies */
  --ink-950: #07111f;
  --ink-900: #0b1526;
  --ink-850: #111c2f;
  --ink-800: #172338;
  --ink-700: #243149;
  --ink-500: #64748b;
  --ink-300: #cbd5e1;
  --ink-100: #f1f5f9;

  /* Lineas y foco */
  --line-subtle: rgba(148, 163, 184, 0.18);
  --line-strong: rgba(148, 163, 184, 0.36);
  --focus-ring: rgba(26, 86, 219, 0.42);
}
```

### Uso del color

| Contexto | Color | Regla |
|---|---|---|
| CTA principal | `--banex-blue-500` | Subir, procesar, descargar |
| Reintegro calculado | `--cash-green-500` | Montos a favor, estados correctos |
| `NO_EXTRACT` | `--risk-red-500` | Pago QR sin extracto bancario |
| `NO_QR` | `--risk-amber-500` | Extracto sin pago QR asociado |
| `AMOUNT_MISMATCH` | `--risk-orange-500` | Diferencia de monto por tolerancia |
| Datos secundarios | `--ink-500` | Ayudas, fechas, labels |

---

## Tipografia

Para una interfaz financiera se recomienda separar lectura general y cifras.

```css
--font-sans: "Aptos", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

--text-xs: 0.75rem / 1rem;
--text-sm: 0.875rem / 1.25rem;
--text-base: 1rem / 1.5rem;
--text-lg: 1.125rem / 1.75rem;
--text-xl: 1.25rem / 1.75rem;
--text-2xl: 1.5rem / 2rem;
--text-3xl: 1.875rem / 2.25rem;
```

Reglas:

- Montos USDT, Bs., porcentajes y tipo de cambio usan `font-mono tabular-nums`.
- Títulos usan `font-semibold tracking-tight`.
- Badges usan `text-xs font-semibold uppercase tracking-wide`.
- Nunca mostrar montos financieros como `number.toString()` sin formato fijo.

---

## Layout base Astro

El frontend actual está en `frontend/` con Astro, React y Tailwind v4 mediante `@tailwindcss/vite`. La estructura recomendada es:

```text
frontend/src/
  layouts/
    AppShell.astro
  pages/
    index.astro
    uploads/index.astro
    rebates/index.astro
    tiers/index.astro
    reconciliation/index.astro
    simulator/index.astro
  components/
    Sidebar.astro
    Topbar.astro
    EmptyState.astro
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
```

### AppShell

```text
┌────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: periodo activo, estado API, accion subir         │
│         ├──────────────────────────────────────────────────────────┤
│         │ Contenido de pagina                                      │
└─────────┴──────────────────────────────────────────────────────────┘
```

Reglas de navegación:

- Desktop: sidebar fija de 264px con estado activo visible.
- Tablet: sidebar compacta con iconos y tooltips.
- Mobile: navegación inferior con 4 acciones: Dashboard, Subir, Reintegros, Alertas.
- Cada página muestra período activo y último upload procesado cuando aplique.

---

## Modelo de islands

Astro debe renderizar HTML estático por defecto. React se usa solo donde hay interacción real.

| Island | Directiva | Motivo |
|---|---|---|
| `UploadDropzone` | `client:load` | Drag and drop inmediato |
| `JobProgress` | `client:load` | Socket.IO debe escuchar desde el inicio |
| `RebatesTable` | `client:load` | Tabla interactiva, filtros y virtualización |
| `TiersEditor` | `client:load` | Formularios y validación de rangos |
| `AnomalyPanel` | `client:load` | Filtros, exportación y explicación IA opcional |
| `WhatIfSimulator` | `client:load` | Recalculo local con el motor de niveles |
| Gráficos del dashboard | `client:visible` | Hidratar solo al entrar al viewport |

Cada island que use TanStack Query monta su propio `QueryClientProvider`. Si dos islands necesitan compartir estado simple, usar Nano Stores o eventos del navegador antes que un provider global React.

---

## Componentes clave

### KPI Card

Uso: dashboard ejecutivo y resumen posterior al procesamiento.

```text
┌────────────────────────────────────┐
│ Total reintegrado          +12.4%  │
│ 1,234.56000000 USDT                │
│ Bs. 8,621.92                       │
│ Periodo: 2026-05                   │
└────────────────────────────────────┘
```

Props sugeridas: `label`, `primary`, `secondary`, `trend`, `period`, `status`.

Reglas:

- Cifra principal siempre en mono.
- Delta en verde si baja costo operativo o sube adopción; rojo si suben anomalías.
- Skeleton antes de datos, no spinner dentro de tarjetas.

### Upload Dropzone

Estados obligatorios:

1. Vacío: explica formatos aceptados y que no hay integración directa.
2. Archivo seleccionado: muestra nombre, tamaño, hash parcial si ya fue calculado y validación de extensión.
3. Preview: primeras filas, hojas detectadas y período inferido.
4. Error: formato inválido, columnas faltantes o tamaño excedido.
5. Enviado: enlaza con `JobProgress`.

```text
┌────────────────────────────────────────────────────────────┐
│ Arrastra el reporte mensual de pagos QR                    │
│ Excel o CSV. Procesamiento independiente de Banexcoin core. │
│                                                            │
│ [Seleccionar archivo]                                      │
└────────────────────────────────────────────────────────────┘
```

### JobProgress

Debe mapear exactamente los eventos emitidos por el backend.

| Progreso | Mensaje UX |
|---|---|
| 5% | Leyendo archivo y validando estructura |
| 25% | Normalizando transacciones QR |
| 45% | Calculando consumo mensual por usuario |
| 65% | Aplicando niveles de reintegro |
| 80% | Conciliando contra extracto bancario |
| 95% | Guardando resultados y preparando resumen |
| 100% | Proceso completado |

El estado final debe mostrar `rebateCount`, `anomalyCount`, `parseErrorCount` y accesos directos a reportes.

### LevelBadge

| Nivel | Nombre | Color | Uso |
|---|---|---|---|
| 1 | Base | `#94a3b8` | Consumo inicial |
| 2 | Bronce | `#d97706` | Consumo medio bajo |
| 3 | Plata | `#cbd5e1` | Consumo medio |
| 4 | Oro | `#eab308` | Alto consumo |
| 5 | Platino | `#818cf8` | Máximo nivel |

Variantes: `solid`, `soft`, `outline`, `dot`.

### Rebate Amount

Componente para mostrar reintegros con equivalencia:

```text
7.01024511 USDT
Bs. 49.00 · T/C 6.98960000
```

Reglas:

- USDT: máximo 8 decimales.
- Bs.: 2 decimales.
- Tipo de cambio: 6 a 8 decimales según dato fuente.

### RebatesTable

Columnas mínimas:

| Columna | Formato |
|---|---|
| Usuario / cuenta | nombre o ID + número de cuenta |
| Total consumido | Bs. con 2 decimales |
| Equivalente USDT | 8 decimales |
| Nivel | `LevelBadge` |
| % reintegro | porcentaje fijo |
| Reintegro USDT | mono, destacado |
| Reintegro Bs. | mono |
| T/C promedio | mono |
| Estado | pendiente, exportado, pagado |

Requisitos de UX:

- Filtros por período, nivel, estado y búsqueda por usuario/cuenta.
- Virtualización para más de 1.000 filas.
- Drawer lateral con transacciones fuente del usuario.
- Exportar selección o reporte completo.

### AnomalyPanel

Tipos visuales:

| Tipo | Label | Color | Acción esperada |
|---|---|---|---|
| `NO_EXTRACT` | Pago QR sin extracto | rojo | Revisar si el banco no reportó el movimiento |
| `NO_QR` | Extracto sin pago QR | ámbar | Revisar transacción externa o duplicada |
| `AMOUNT_MISMATCH` | Monto diferente | naranja | Validar tipo de cambio, redondeo o corrección manual |

Debe incluir conteos, filtros, delta, referencia de fila y exportación CSV/Excel.

### TiersEditor

Editor de rangos definido por Banexcoin.

Reglas de validación:

- `minAmountBOB` y `maxAmountBOB` son montos positivos.
- No puede haber solapamientos.
- No debe haber huecos si negocio exige cobertura completa.
- El nivel superior puede tener `maxAmountBOB = null`.
- Cambios aplican desde un período efectivo, no retroactivamente salvo confirmación explícita.

### WhatIfSimulator

Simula cambios de niveles sin persistir.

Debe mostrar:

- Distribución de usuarios por nivel.
- Costo total estimado en USDT y Bs.
- Variación contra configuración actual.
- Usuarios que cambian de nivel.
- Botón para llevar propuesta al editor, no guardado directo.

---

## Pantallas

### Dashboard `/`

Objetivo: resumen ejecutivo del último período.

Incluye:

- KPIs: total reintegrado, usuarios beneficiados, consumo total, anomalías abiertas.
- Últimos uploads con estado.
- Distribución por nivel.
- Reintegro por semana o por día.
- CTA principal: `Subir reporte mensual`.

### Uploads `/uploads`

Objetivo: cargar reportes y consultar historial.

Incluye:

- Dropzone.
- Reglas de archivo aceptado.
- Historial con hash, período, estado y fecha.
- Acceso a reportes generados por upload.

### Reintegros `/rebates`

Objetivo: revisar, filtrar y exportar los cálculos.

Incluye:

- Tabla principal.
- Drawer de detalle por usuario.
- Descarga de Excel y BanexTransfer.
- Marcado operativo `pagado` cuando corresponda.

### Niveles `/tiers`

Objetivo: administrar reglas de cashback por rango de consumo.

Incluye:

- Editor de rangos.
- Validación en vivo.
- Historial de vigencia.
- Botón `Simular impacto`.

### Conciliación `/reconciliation`

Objetivo: explicar y resolver diferencias entre Pago QR y extracto.

Incluye:

- Resumen por tipo.
- Tabla de anomalías.
- Filtros por tipo y severidad.
- Exportación de anomalías.
- Botón opcional `Explicar con IA` si existe backend configurado.

### Simulador `/simulator`

Objetivo: analizar impacto de cambios en niveles antes de guardarlos.

Incluye:

- Sliders o inputs monetarios.
- Impacto financiero inmediato.
- Comparación contra configuración vigente.
- CTA hacia `/tiers` con propuesta precargada.

---

## Estados de UI

| Estado | Regla |
|---|---|
| Loading inicial | Skeleton por componente, no pantalla blanca |
| Empty | Explicar qué falta y ofrecer CTA directo |
| Error recuperable | Mensaje claro + acción de reintento |
| Error de archivo | Mostrar columna/fila faltante si se conoce |
| Procesando | Barra con porcentaje y mensaje del worker |
| Completado con alertas | Estado exitoso, pero destacar anomalías abiertas |

---

## Responsive

| Breakpoint | Comportamiento |
|---|---|
| `< 640px` | Navegación inferior, cards apiladas, tablas con columnas fijas y scroll horizontal |
| `640px - 1024px` | Sidebar compacta, grids de 2 columnas, filtros colapsables |
| `> 1024px` | Sidebar completa, dashboards de 12 columnas, drawers laterales |

Tablas financieras no deben truncar montos. Si falta espacio, ocultar columnas secundarias antes que recortar valores.

---

## Accesibilidad

- Contraste mínimo AA en texto y controles.
- Foco visible en inputs, botones y filas clicables.
- Estados de anomalía no dependen solo del color; siempre incluyen texto.
- Dropzone tiene input file accesible por teclado.
- Tablas tienen encabezados semánticos y `aria-sort` cuando aplique.
- Las animaciones respetan `prefers-reduced-motion`.

---

## Motion

Usar movimiento con intención operativa.

| Elemento | Animación | Duración |
|---|---|---|
| Cards al cargar | Fade + translateY leve | 180ms |
| Dropzone hover | Borde y glow azul | 120ms |
| Progreso | Width transition | 250ms |
| Resultado final | Check + reveal de acciones | 300ms |
| Drawer | Slide right | 220ms |
| Filtros aplicados | Highlight temporal en tabla | 180ms |

Evitar animar cifras financieras de forma que parezcan cambiar después del cálculo final.

---

## Variables de entorno del frontend

| Variable | Uso |
|---|---|
| `PUBLIC_API_URL` | Base URL del backend NestJS expuesta al navegador |

Regla Astro: solo variables con prefijo `PUBLIC_` pueden ser usadas dentro de islands que corren en browser.

---

## Checklist de implementación visual

- `frontend/src/styles/global.css` define tokens base y estilos globales.
- `AppShell.astro` centraliza navegación, topbar y contenedor.
- Islands usan `client:*` solo cuando necesitan interacción.
- Montos se formatean con helpers compartidos.
- Los tres estados críticos (`processing`, `done`, `failed`) existen en upload.
- Las tablas soportan miles de filas sin congelar la UI.
- El diseño comunica independencia: carga manual de archivos, sin prometer conexión directa al core de Banexcoin.
