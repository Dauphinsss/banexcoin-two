# BanexReintegra — Design

Sistema de diseño completo: tokens, componentes, pantallas y flujos de usuario.

---

## Design tokens

### Colores

```css
/* Marca */
--color-brand-500: #1A56DB;   /* azul Banexcoin — CTAs primarios */
--color-brand-400: #3F83F8;   /* hover de primarios */
--color-brand-600: #1C3FAA;   /* pressed de primarios */
--color-brand-50:  #EBF5FF;   /* fondos de highlight */

/* Éxito / Reintegro */
--color-green-500: #0E9F6E;
--color-green-400: #31C48D;
--color-green-600: #057A55;
--color-green-50:  #F3FAF7;

/* Anomalías */
--color-red-500:    #EF4444;  /* NO_EXTRACT */
--color-amber-500:  #F59E0B;  /* NO_QR */
--color-orange-500: #F97316;  /* AMOUNT_MISMATCH */

/* Neutros */
--color-gray-50:  #F9FAFB;
--color-gray-100: #F3F4F6;
--color-gray-200: #E5E7EB;
--color-gray-400: #9CA3AF;
--color-gray-600: #4B5563;
--color-gray-800: #1F2937;
--color-gray-900: #111827;

/* Superficies dark mode */
--surface-base:  #111827;
--surface-card:  #1F2937;
--surface-input: #374151;
--surface-hover: #2D3748;
```

### Niveles — identidad visual

```
Nivel 1  Básico   #94A3B8  gris plata   Shield
Nivel 2  Bronce   #D97706  bronce       ShieldCheck
Nivel 3  Plata    #CBD5E1  plata        Star
Nivel 4  Oro      #EAB308  oro          StarFill
Nivel 5  Platino  #818CF8  violeta      Crown
```

### Tipografía

```css
/* Fuente */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Escala */
--text-xs:   0.75rem  / 1rem;
--text-sm:   0.875rem / 1.25rem;
--text-base: 1rem     / 1.5rem;
--text-lg:   1.125rem / 1.75rem;
--text-xl:   1.25rem  / 1.75rem;
--text-2xl:  1.5rem   / 2rem;
--text-3xl:  1.875rem / 2.25rem;

/* Regla de uso */
/* Dinero y cifras → font-mono tabular-nums (los decimales se alinean) */
/* Headings       → font-semibold tracking-tight                        */
/* Labels/badges  → font-medium text-xs uppercase tracking-wide         */
```

### Espaciado y radio

```css
--radius-sm: 0.375rem;   /* inputs, badges pequeños */
--radius-md: 0.5rem;     /* cards, botones */
--radius-lg: 0.75rem;    /* modals, panels */
--radius-xl: 1rem;       /* dropzone, hero cards */
```

---

## Componentes

### KPI Card

Aparece en grupos de 4 en el dashboard ejecutivo.

```
┌─────────────────────────────┐
│  Total reintegrado    ↑ 12% │  ← label + delta vs período anterior
│                             │
│  1,234.56 USDT              │  ← cifra principal (font-mono, text-3xl)
│  Bs 8,621.92                │  ← cifra secundaria (text-sm, gray-400)
│                       [💲]  │  ← icono Lucide alineado a la derecha
└─────────────────────────────┘
```

Props: `label`, `primary`, `secondary?`, `icon`, `delta?`, `deltaLabel?`

Delta verde si positivo, rojo si negativo. Animación de counter con `framer-motion` al montar.

---

### LevelBadge

```
┌──────────────────┐
│  ★ Nivel 4 · Oro │   ← icono + nombre + color semántico del nivel
└──────────────────┘
```

Variantes: `default` (fondo suave), `outline`, `dot` (solo punto de color + texto, para tablas densas).

---

### AnomalyBadge

```
● Sin extracto    (rojo   #EF4444)
● Sin pago QR     (ámbar  #F59E0B)
● Monto difiere   (naranja #F97316)
```

---

### UploadDropzone

Estado vacío:
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│             ⬆  Arrastra el Excel aquí               │
│        o haz clic para seleccionar archivo          │
│                                                     │
│          Acepta: .xlsx — máximo 50 MB               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Estado con archivo (preview antes de confirmar):
```
┌─────────────────────────────────────────────────────┐
│  📄 pago-qr-mayo-2025.xlsx              23 MB   [×] │
├─────────────────────────────────────────────────────┤
│  Preview — primeras 5 filas de "Pago QR"            │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │ Usuario  │  Cuenta  │ BOB      │ USDT     │      │
│  ├──────────┼──────────┼──────────┼──────────┤      │
│  │ jgarcia  │  20045   │ 150.00   │ 21.459   │      │
│  │ mlopez   │  20089   │  80.50   │ 11.519   │      │
│  └──────────┴──────────┴──────────┴──────────┘      │
│  ... y 5.320 filas más                              │
│                                                     │
│  Período detectado: mayo 2025   Filas: 5.325        │
│                                                     │
│        [Cancelar]   [Procesar 5.325 filas →]        │
└─────────────────────────────────────────────────────┘
```

---

### ProgressJob

Aparece tras confirmar el upload. Animado con Framer Motion.

```
┌─────────────────────────────────────────────────────┐
│  Procesando pago-qr-mayo-2025.xlsx                  │
│                                                     │
│  ████████████████░░░░░░░░░░░░░░  65%                │
│                                                     │
│  Conciliando con extracto bancario...               │
│                                                     │
│  ⏱  Tiempo estimado: ~5 segundos                   │
└─────────────────────────────────────────────────────┘
```

Cuando termina, hace morph (Framer Layout) a la tarjeta de resultado:

```
┌─────────────────────────────────────────────────────┐
│  ✓  Procesamiento completado                        │
│                                                     │
│  1.247 reintegros calculados                        │
│  30 anomalías detectadas                            │
│                                                     │
│  [Ver reintegros]   [Ver anomalías]   [Descargar]  │
└─────────────────────────────────────────────────────┘
```

---

### RebatesTable

Tabla principal. TanStack Table con virtualización para 1.000+ filas.

```
┌──┬────────────┬──────────┬──────────────┬──────────┬──────────┬──────────┬───────┐
│  │ Usuario    │ Total BOB│ Nivel        │ Cashback │ USDT     │ BOB      │ T/C ⌀ │
├──┼────────────┼──────────┼──────────────┼──────────┼──────────┼──────────┼───────┤
│  │ jgarcia    │ 2,450.00 │ ★ Oro        │ 2.00%    │   7.0102 │  49.00   │ 6.990 │
│  │ mlopez     │   320.00 │ ◆ Bronce     │ 1.00%    │   0.4577 │   3.20   │ 6.992 │
│  │ aruiz      │ 5,800.00 │ ♛ Platino    │ 3.00%    │  24.930  │ 174.00   │ 6.981 │
└──┴────────────┴──────────┴──────────────┴──────────┴──────────┴──────────┴───────┘

[Buscar usuario...]  [Filtrar nivel ▼]  [Exportar CSV]     Mostrando 1-50 de 1.247
```

Al hacer clic en una fila, abre un **drawer lateral** con todas las transacciones del usuario en el mes.

**Drawer detalle de usuario:**
```
┌─────────────────────────────────────────────────────┐
│  jgarcia — Cuenta #20045                       [×]  │
│  ★ Nivel 4 · Oro · 2.00% cashback                   │
├─────────────────────────────────────────────────────┤
│  Total gastado:    Bs 2,450.00                      │
│  Reintegro:        7.0102 USDT  =  Bs 49.00        │
│  T/C promedio:     6.9896                           │
│                                                     │
│  Transacciones del período (18)                     │
│  ┌──────────┬──────────┬──────────┬───────────────┐  │
│  │ Fecha    │ BOB      │ USDT     │ T/C     │ ✓?  │  │
│  ├──────────┼──────────┼──────────┼─────────┼─────┤  │
│  │ 03/05    │  150.00  │  21.459  │ 6.992   │  ✓ │  │
│  │ 07/05    │   80.00  │  11.432  │ 6.990   │  ✓ │  │
│  │ 12/05    │  220.00  │  31.428  │ 6.999   │  ⚠ │  │ ← anomalía
│  └──────────┴──────────┴──────────┴─────────┴─────┘  │
└─────────────────────────────────────────────────────┘
```

---

### TiersEditor

CRUD de niveles de cashback.

```
┌─────────────────────────────────────────────────────────────────┐
│  Niveles de Cashback                              [+ Añadir]    │
├─────────────────────────────────────────────────────────────────┤
│  ○ Nivel 1 · Básico     Bs 0  –  Bs 500      1.00%   [Editar]  │
│  ○ Nivel 2 · Bronce     Bs 501 – Bs 1.000    1.50%   [Editar]  │
│  ○ Nivel 3 · Plata      Bs 1.001 – Bs 2.500  2.00%   [Editar]  │
│  ★ Nivel 4 · Oro        Bs 2.501 – Bs 5.000  2.50%   [Editar]  │
│  ♛ Nivel 5 · Platino    Bs 5.001 – sin tope  3.00%   [Editar]  │
│                                                                 │
│  ⚠  Validación: rangos sin solapamiento, sin huecos entre ellos│
└─────────────────────────────────────────────────────────────────┘
```

Inline validation: si se edita un rango y crea un solapamiento, se marca en rojo antes de guardar.

---

### ReconciliationPanel

```
┌─────────────────────────────────────────────────────┐
│  Conciliación — Mayo 2025                           │
│                                                     │
│  ✓  5.268 transacciones conciliadas correctamente  │
│  ● 23  sin extracto bancario                (rojo)  │
│  ●  4  en extracto sin pago QR             (ámbar)  │
│  ●  7  con monto diferente                (naranja) │
│                           [Explicar con IA ✦]      │
├─────────────────────────────────────────────────────┤
│  Filtro: [Todas ▼]                  [Exportar CSV]  │
│                                                     │
│  Transacción       Tipo            Delta            │
│  TXN-20250503-001  ● Sin extracto  —                │
│  TXN-20250507-014  ● Monto difiere Bs +0.15         │
│  TXN-20250512-089  ● Sin extracto  —                │
└─────────────────────────────────────────────────────┘
```

---

### WhatIfSimulator

Pantalla de simulación sin tocar base de datos.

```
┌─────────────────────────────────────────────────────────────────┐
│  Simulador de niveles                           [Restablecer]   │
├────────────────────────────┬────────────────────────────────────┤
│  Configuración             │  Impacto en tiempo real            │
│                            │                                    │
│  Nivel 1 · Básico          │  ┌────────────────────────────┐   │
│  BOB  [0] ─────── [500]    │  │  Básico   ▓░░░░░░ 38%  473 │   │
│  Cashback  [1.00%]         │  │  Bronce   ▓▓░░░░░ 22%  274 │   │
│                            │  │  Plata    ▓▓▓░░░░ 18%  225 │   │
│  Nivel 2 · Bronce          │  │  Oro      ▓▓▓▓░░░ 14%  175 │   │
│  BOB  [501] ──── [1.000]   │  │  Platino  ▓▓▓▓▓░░  8%  100 │   │
│  Cashback  [1.50%]         │  └────────────────────────────┘   │
│                            │                                    │
│  ...                       │  Costo total tesorería:            │
│                            │  1,847.32 USDT  =  Bs 12,913.05  │
│                            │                                    │
│                            │  vs configuración actual:          │
│                            │  ▲ +120.50 USDT (+6.98%)          │
└────────────────────────────┴────────────────────────────────────┘
```

Los deslizadores usan el `tier-engine` de `packages/utils` directamente en el cliente. Sin llamadas a API.

---

## Pantallas

### 1. Dashboard ejecutivo `/`

```
┌─────────────────────────────────────────────────────────────────┐
│  BanexReintegra                          Mayo 2025  [Subir ▲]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Reintegrado│  │ Usuarios   │  │ Ticket ⌀   │  │ Anomalías│  │
│  │ 1,234 USDT │  │   1.247    │  │ Bs 1.250   │  │    34    │  │
│  │ ↑ 12%      │  │ ↑ 8%       │  │ ↓ 3%       │  │  ⚠ 34   │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│                                                                 │
│  Distribución por nivel                 Reintegros por semana  │
│  ┌────────────────────────┐             ┌──────────────────────┐│
│  │  Básico  38%           │             │      ▂ ▄ █ ▆ ▃       ││
│  │  Bronce  22%   (donut) │             │   semana 1 2 3 4     ││
│  │  Plata   18%           │             │                      ││
│  │  Oro     14%           │             └──────────────────────┘│
│  │  Platino  8%           │                                     │
│  └────────────────────────┘                                     │
│                                                                 │
│  Últimos uploads                                                │
│  pago-qr-mayo-2025.xlsx   ✓ Listo   1.247 reintegros   [Ver]  │
│  pago-qr-abr-2025.xlsx    ✓ Listo   1.195 reintegros   [Ver]  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Tabla de reintegros `/rebates`

Pantalla completa con la `RebatesTable`. Filtros en sidebar o toolbar.

```
┌─────────────────────────────────────────────────────────────────┐
│  Reintegros — Mayo 2025             [Descargar Excel] [BanexTx]│
├──────────────────────────┬──────────────────────────────────────┤
│  Filtros                 │                                      │
│  Período: [Mayo 2025 ▼]  │  [Buscar usuario...]   [Nivel ▼]    │
│  Nivel: [Todos ▼]        │                                      │
│  Estado: [Todos ▼]       │  [RebatesTable completa aquí]       │
│                          │                                      │
│  [Aplicar]               │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

---

### 3. Upload `/uploads/new`

Página dedicada al flujo de upload. Tres estados con transición Framer Motion:

```
Estado A: Dropzone vacío
Estado B: Preview + confirmación  
Estado C: Progreso + resultado
```

---

### 4. Conciliación `/reconciliation`

Panel de anomalías + tabla filtrable. Botón "Explicar con IA" en la cabecera.

---

### 5. Niveles `/tiers`

Editor de niveles con validación visual inline + historial de cambios (quién modificó qué y cuándo).

---

### 6. Simulador `/simulator`

Two-panel layout: configuración a la izquierda, impacto en vivo a la derecha.

---

## Navegación lateral

```
┌─────────────────┐
│  Banex          │
│  Reintegra      │
├─────────────────┤
│  ▣ Dashboard    │
│  ⇅ Reintegros  │
│  ↑ Subir Excel  │
│  ⚠ Conciliación│
│  ◈ Niveles      │
│  ⚙ Simulador   │
└─────────────────┘
```

Sidebar colapsable en mobile (hamburger). Breadcrumb en la cabecera de cada página.

---

## Flujos de usuario

### Flujo principal: procesar un mes

```
Usuario llega al dashboard
    │
    ▼
Clic en "Subir ▲"
    │
    ▼
Dropzone → arrastra Excel
    │
    ▼
Preview de filas + confirmación del período
    │
    ├─ [Cancelar] → vuelve al dashboard
    │
    └─ [Procesar] → barra de progreso WebSocket
                        │
                        ▼
                   Job completado → tarjeta de resultado
                        │
                        ├─ [Ver reintegros] → /rebates?uploadId=X
                        ├─ [Ver anomalías]  → /reconciliation?uploadId=X
                        └─ [Descargar]      → Excel + BanexTransfer
```

### Flujo de ajuste de niveles

```
/tiers → editar rango de un nivel
    │
    ├─ Validación inline: ¿solapamiento?
    │       Sí → badge rojo, botón guardar desactivado
    │       No → badge verde, guardar habilitado
    │
    └─ [Guardar] → modal "¿Aplicar a partir de qué período?"
                        │
                        └─ Confirmar → nivel actualizado
```

### Flujo del simulador

```
/simulator → carga automáticamente el último upload
    │
    ├─ Mover deslizador de rango
    │       ▼
    │   Re-calcula en cliente con tier-engine (sin API)
    │   Actualiza gráfico de distribución y costo total
    │
    └─ [Guardar como nueva configuración] → redirige a /tiers con valores pre-cargados
```

---

## Animaciones (Framer Motion)

| Elemento | Animación | Duración |
|---|---|---|
| Dropzone en hover | `scale: 1.02`, borde azul | 150ms ease |
| Upload → progreso | Layout morph (height expand) | 300ms spring |
| Progreso → resultado | Layout morph + fade-in checkmark | 400ms spring |
| KPI cards al montar | Stagger fade-up (50ms entre cards) | 200ms ease-out |
| Drawer lateral | Slide desde la derecha | 250ms ease-in-out |
| Counter de cifras | Contador animado de 0 al valor final | 800ms ease-out |
| Filas de tabla al filtrar | Fade-out filas eliminadas | 150ms |

**Regla:** las animaciones que responden a acción del usuario (<300ms) no tienen `delay`. Las animaciones decorativas de montaje sí pueden tener stagger.

---

## Responsive

| Breakpoint | Cambio principal |
|---|---|
| `< 768px` | Sidebar se convierte en bottom nav. KPI cards en 2×2. Tabla solo muestra 4 columnas. |
| `768px – 1024px` | Sidebar colapsado por defecto. Two-panel del simulador se apila. |
| `> 1024px` | Layout completo como en los wireframes. |

La tabla de reintegros usa scroll horizontal en mobile sin truncar datos (columnas fijas: Usuario y Nivel; resto scrollable).

---

## Dark mode

shadcn/ui usa CSS variables y soporte de dark mode con `class="dark"` en `<html>`. Añadir al `tailwind.config.ts`:

```typescript
darkMode: 'class'
```

Toggle en la barra superior. Preferencia guardada en `localStorage`. En el primer render se lee del sistema operativo con `prefers-color-scheme`.

Todas las superficies usan los tokens `--surface-*` definidos arriba. No hardcodear `bg-white` ni `bg-gray-900` directamente.

---

## Modelo de islands (Astro + React)

Cada página `.astro` es HTML estático. Los componentes React se montan como islands solo donde hay interactividad.

### Patrón de página Astro

```astro
---
// src/pages/rebates/index.astro
import DashboardLayout from '@/layouts/DashboardLayout.astro'
import RebatesTable from '@/islands/rebates/RebatesTable'

// Los datos iniciales se pueden cargar aquí en build time o SSR
// y pasarse como props al island para evitar un flash de carga
const uploadId = Astro.url.searchParams.get('uploadId') ?? ''
---

<DashboardLayout title="Reintegros">
  <RebatesTable client:load uploadId={uploadId} />
</DashboardLayout>
```

### Cómo evitar el flash de carga (prop drilling desde Astro)

Para páginas que tienen datos estáticos predecibles (lista de niveles, KPIs del último período), Astro los carga en el frontmatter y los pasa como props serializadas al island. El island arranca con datos reales en lugar de spinner.

```astro
---
const res = await fetch(`${import.meta.env.PUBLIC_API_URL}/rebates/summary`)
const summary = await res.json()
---
<KpiCards client:load initialData={summary} />
```

### Islands que necesitan QueryClientProvider

`RebatesTable` y `TiersEditor` usan TanStack Query internamente. Cada uno monta su propio `QueryClientProvider` localmente:

```tsx
// src/islands/rebates/RebatesTable.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RebatesTable(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <RebatesTableInner {...props} />
    </QueryClientProvider>
  )
}
```

Esto es intencional en Astro: cada island es independiente. Si dos islands necesitan compartir estado, la solución es un store de Nano Stores (`@nanostores/react`) compartido entre ambas.

### Estado compartido entre islands (Nano Stores)

```typescript
// src/lib/stores.ts
import { atom } from 'nanostores'

export const activeUploadId = atom<string | null>(null)
export const jobStatus = atom<'idle' | 'processing' | 'done' | 'error'>('idle')
```

`JobProgress.tsx` escribe en `jobStatus`. `RebatesTable.tsx` lo lee para saber cuándo refrescar. Sin prop drilling entre islands, sin contexto global de React.

### Variables de entorno en Astro

| Variable | Dónde se usa | Prefijo |
|---|---|---|
| `PUBLIC_API_URL` | Islands (cliente) | `PUBLIC_` → expuesta al browser |
| `API_SECRET` | Frontmatter `.astro` (servidor) | Sin prefijo → solo en build/SSR |
