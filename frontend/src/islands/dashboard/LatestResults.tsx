import { useEffect, useMemo, useState } from 'react'
import type {
  AnomalyDTO,
  MonthlyRebateDTO,
  ReconciliationStats,
  UploadSummary,
} from '@banex/types'
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CircleDollarSign,
  FileSpreadsheet,
  Inbox,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useCounter } from '../../lib/use-counter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const money = (value: string | number, fractionDigits = 2) =>
  Number(value).toLocaleString('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

const integer = (value: number) => value.toLocaleString('es-BO')

interface LatestState {
  upload: UploadSummary | null
  rebates: MonthlyRebateDTO[]
  anomalies: AnomalyDTO[]
  stats: ReconciliationStats | null
}

// Orden canónico de niveles para la distribución.
const TIER_ORDER = ['Base', 'Bronce', 'Plata', 'Oro', 'Platino']
const TIER_COLOR: Record<string, string> = {
  Base: '#94a3b8',
  Bronce: '#d97706',
  Plata: '#cbd5e1',
  Oro: '#eab308',
  Platino: '#818cf8',
}

export function LatestResults() {
  const [state, setState] = useState<LatestState>({
    upload: null,
    rebates: [],
    anomalies: [],
    stats: null,
  })
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const uploads = await api.listUploads()
        const upload = uploads.find((item) => item.status === 'DONE') ?? null
        if (!upload) {
          if (!cancelled) setStatus('empty')
          return
        }

        const [rebates, anomalies, stats] = await Promise.all([
          api.listRebates(upload.id),
          api.listAnomalies(upload.id),
          api.reconciliationStats(upload.id),
        ])

        if (!cancelled) {
          setState({ upload, rebates, anomalies, stats })
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const derived = useMemo(() => {
    const rebateUSDT = state.rebates.reduce((sum, row) => sum + Number(row.rebateUSDT), 0)
    const rebateBOB = state.rebates.reduce((sum, row) => sum + Number(row.rebateBOB), 0)
    const spentBOB = state.rebates.reduce((sum, row) => sum + Number(row.totalSpentBOB), 0)
    const transactions = state.rebates.reduce((sum, row) => sum + row.transactionCount, 0)

    // Distribución por nivel.
    const tierCount = new Map<string, number>()
    for (const row of state.rebates) {
      const name = row.tierName ?? 'Sin nivel'
      tierCount.set(name, (tierCount.get(name) ?? 0) + 1)
    }
    const buckets = [...tierCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) =>
          (TIER_ORDER.indexOf(a.name) + 1 || 99) - (TIER_ORDER.indexOf(b.name) + 1 || 99) ||
          b.count - a.count,
      )

    // Curva de reintegro USDT acumulado (usuarios ordenados por aporte desc).
    const sorted = [...state.rebates].sort(
      (a, b) => Number(b.rebateUSDT) - Number(a.rebateUSDT),
    )
    const points: number[] = []
    const sampleEvery = Math.max(1, Math.floor(sorted.length / 24))
    let acc = 0
    sorted.forEach((row, i) => {
      acc += Number(row.rebateUSDT)
      if (i % sampleEvery === 0) points.push(acc)
    })
    if (points.at(-1) !== acc) points.push(acc)

    return {
      rebateUSDT,
      rebateBOB,
      averageTicket: transactions === 0 ? 0 : spentBOB / transactions,
      transactions,
      buckets,
      curve: points.length > 1 ? points : [0, rebateUSDT],
    }
  }, [state.rebates])

  const animRebate = useCounter(derived.rebateUSDT, 1300)
  const animUsers = useCounter(state.rebates.length, 900)
  const animTicket = useCounter(derived.averageTicket, 1100)
  const animAnom = useCounter(state.stats?.total ?? state.anomalies.length, 900)

  if (status === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <Inbox className="size-7" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold">Todavía no hay uploads procesados</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Sube el Excel mensual para activar el cálculo de reintegros, conciliación y descargas operativas.
            </p>
          </div>
          <Button asChild>
            <a href="/uploads/new">
              Subir Excel
              <ArrowRight />
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>No se pudieron cargar los resultados</AlertTitle>
        <AlertDescription>Revisa la conexión con la API o inténtalo nuevamente.</AlertDescription>
      </Alert>
    )
  }

  const reconciliationRate = Number(state.stats?.reconciliationRate ?? 0)
  const anomalyTotal = state.stats?.total ?? state.anomalies.length
  const parseErrors = state.upload?.parseErrorCount ?? 0

  return (
    <div className="stagger space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Reintegrado"
          value={money(animRebate, 4)}
          suffix="USDT"
          secondary={`Bs ${money(derived.rebateBOB, 0)}`}
          icon={<CircleDollarSign className="size-4" />}
          accent="primary"
          spark={derived.curve}
        />
        <KpiCard
          label="Usuarios"
          value={integer(Math.round(animUsers))}
          secondary={`${integer(derived.transactions)} transacciones`}
          icon={<Users className="size-4" />}
          accent="emerald"
        />
        <KpiCard
          label="Ticket promedio"
          value={money(animTicket)}
          suffix="BOB"
          secondary="por transacción"
          icon={<FileSpreadsheet className="size-4" />}
          accent="violet"
        />
        <KpiCard
          label="Anomalías"
          value={integer(Math.round(animAnom))}
          secondary={`conciliación ${reconciliationRate.toFixed(2)}%`}
          icon={<ShieldAlert className="size-4" />}
          accent={anomalyTotal > 0 ? 'amber' : 'emerald'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardDescription className="text-[10px] uppercase tracking-[0.18em]">
                USDT reintegrado · acumulado
              </CardDescription>
              <CardTitle className="text-base">Trayectoria del cierre</CardTitle>
            </div>
            <span className="font-mono text-sm font-medium tabular-nums text-emerald-400">
              {money(derived.rebateUSDT, 4)} USDT
            </span>
          </CardHeader>
          <CardContent>
            <RebateChart series={derived.curve} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardDescription className="text-[10px] uppercase tracking-[0.18em]">
                Distribución
              </CardDescription>
              <CardTitle className="text-base">Usuarios por nivel</CardTitle>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {state.rebates.length} usuarios
            </Badge>
          </CardHeader>
          <CardContent>
            <TierDistribution buckets={derived.buckets} total={state.rebates.length} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardDescription className="text-[10px] uppercase tracking-[0.18em]">
                Archivo activo
              </CardDescription>
              <CardTitle className="text-base">Último procesamiento</CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-1">{state.upload?.filename}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {state.upload?.period ?? 'Sin periodo'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Filas QR" value={integer(state.upload?.rowCount ?? 0)} />
              <Metric
                label="Parse errors"
                value={String(parseErrors)}
                tone={parseErrors > 0 ? 'amber' : 'default'}
              />
              <Metric label="Transacciones" value={integer(derived.transactions)} />
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Conciliación bancaria
                </p>
                <p className="font-mono text-sm font-medium tabular-nums">
                  {reconciliationRate.toFixed(2)}%
                </p>
              </div>
              <Progress value={reconciliationRate} className="h-2" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="secondary" size="sm">
                <a href={`/uploads/${state.upload?.id}`}>
                  Ver resultados
                  <ArrowUpRight />
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href="/reconciliation">Ir a conciliación</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1.5">
            <CardDescription className="text-[10px] uppercase tracking-[0.18em]">
              Riesgo operativo
            </CardDescription>
            <CardTitle className="text-base">Anomalías detectadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Metric
              label="Sin extracto"
              value={String(state.stats?.noExtract ?? 0)}
              tone={(state.stats?.noExtract ?? 0) > 0 ? 'amber' : 'default'}
            />
            <Metric
              label="Sin QR"
              value={String(state.stats?.noQr ?? 0)}
              tone={(state.stats?.noQr ?? 0) > 0 ? 'amber' : 'default'}
            />
            <Metric
              label="Monto distinto"
              value={String(state.stats?.amountMismatch ?? 0)}
              tone={(state.stats?.amountMismatch ?? 0) > 0 ? 'primary' : 'default'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type Accent = 'primary' | 'emerald' | 'violet' | 'amber'

const ACCENT_STYLES: Record<
  Accent,
  { bar: string; icon: string; ring: string; stroke: string }
> = {
  primary: {
    bar: 'bg-primary',
    icon: 'bg-primary/15 text-primary',
    ring: 'ring-primary/25',
    stroke: 'var(--primary)',
  },
  emerald: {
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-500/15 text-emerald-400',
    ring: 'ring-emerald-500/25',
    stroke: '#10b981',
  },
  violet: {
    bar: 'bg-violet-500',
    icon: 'bg-violet-500/15 text-violet-400',
    ring: 'ring-violet-500/25',
    stroke: '#8b5cf6',
  },
  amber: {
    bar: 'bg-amber-500',
    icon: 'bg-amber-500/15 text-amber-400',
    ring: 'ring-amber-500/25',
    stroke: '#f59e0b',
  },
}

function KpiCard({
  label,
  value,
  suffix,
  secondary,
  icon,
  accent,
  spark,
}: {
  label: string
  value: string
  suffix?: string
  secondary?: string
  icon: React.ReactNode
  accent: Accent
  spark?: number[]
}) {
  const styles = ACCENT_STYLES[accent]
  return (
    <Card className="relative overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${styles.bar}`} />
      {spark && spark.length > 1 ? (
        <div className="pointer-events-none absolute right-3 top-4 opacity-80">
          <Sparkline data={spark} stroke={styles.stroke} />
        </div>
      ) : null}
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <span
            className={`flex size-7 items-center justify-center rounded-md ring-1 ${styles.icon} ${styles.ring}`}
          >
            {icon}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
        </div>
        {secondary ? (
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{secondary}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Sparkline({
  data,
  stroke,
  w = 88,
  h = 30,
}: {
  data: number[]
  stroke: string
  w?: number
  h?: number
}) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pad = 2
  const xs = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2)
  const ys = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2)
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="draw-line"
        style={{ ['--len' as string]: '220' }}
      />
    </svg>
  )
}

function RebateChart({ series }: { series: number[] }) {
  const w = 640
  const h = 200
  const pad = { l: 44, r: 14, t: 14, b: 24 }
  const max = Math.max(...series, 1) * 1.08
  const xs = (i: number) => pad.l + (i / (series.length - 1 || 1)) * (w - pad.l - pad.r)
  const ys = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b)
  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(v)}`).join(' ')
  const area = `${line} L${xs(series.length - 1)},${h - pad.b} L${pad.l},${h - pad.b} Z`
  const ticks = Array.from({ length: 5 }, (_, i) => (max * i) / 4)
  const lastX = xs(series.length - 1)
  const lastY = ys(series.at(-1) ?? 0)

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rebateArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={ys(t)}
            y2={ys(t)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="2 3"
            className="text-muted-foreground"
          />
          <text
            x={pad.l - 8}
            y={ys(t) + 3}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize="9"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path
        d={area}
        fill="url(#rebateArea)"
        style={{ animation: 'fadeIn 0.8s ease 0.4s backwards' }}
      />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="draw-line"
        style={{ ['--len' as string]: '1400' }}
      />
      {series.length > 1 ? (
        <>
          <circle
            cx={lastX}
            cy={lastY}
            r="8"
            fill="none"
            stroke="var(--primary)"
            strokeOpacity="0.3"
            className="chart-endpoint"
          />
          <circle
            cx={lastX}
            cy={lastY}
            r="3.5"
            fill="var(--background)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
        </>
      ) : null}
    </svg>
  )
}

function TierDistribution({
  buckets,
  total,
}: {
  buckets: { name: string; count: number }[]
  total: number
}) {
  if (buckets.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin niveles para mostrar.</p>
  }
  return (
    <div className="space-y-3">
      {buckets.map((b, i) => {
        const pct = total === 0 ? 0 : (b.count / total) * 100
        const color = TIER_COLOR[b.name] ?? '#94a3b8'
        return (
          <div key={b.name} className="grid grid-cols-[16px_64px_1fr_56px] items-center gap-3">
            <span
              className="size-2.5 rounded-full"
              style={{ background: color }}
              aria-hidden="true"
            />
            <span className="text-sm text-foreground">{b.name}</span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="tier-bar-fill absolute inset-y-0 left-0 block rounded-full"
                style={{
                  ['--w' as string]: `${pct}%`,
                  background: color,
                  animationDelay: `${0.2 + i * 0.08}s`,
                }}
              />
            </span>
            <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
              {b.count} · {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'amber' | 'primary'
}) {
  const valueClass =
    tone === 'amber'
      ? 'text-amber-400'
      : tone === 'primary'
        ? 'text-primary'
        : 'text-foreground'
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  )
}
