import { useEffect, useMemo, useState } from 'react'
import type {
  AnomalyDTO,
  MonthlyRebateDTO,
  ReconciliationStats,
  UploadSummary,
} from '@banex/types'
import {
  ArrowUpRight,
  CircleAlert,
  CircleDollarSign,
  FileSpreadsheet,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatPeriodLabel } from '../../lib/format'
import { useCounter } from '../../lib/use-counter'
import { EmptyState } from '../shared/EmptyState'
import { LevelBadge, getLevelColor } from '../../components/LevelBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const money = (value: string | number, fractionDigits = 2) =>
  Number(value).toLocaleString('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

const integer = (value: number) => value.toLocaleString('es-BO')

const cumulativeCurve = (values: number[], maxPoints = 18) => {
  if (values.length === 0) return [0, 0]

  const sampleEvery = Math.max(1, Math.floor(values.length / maxPoints))
  const points: number[] = []
  let acc = 0

  values.forEach((value, index) => {
    acc += value
    if (index % sampleEvery === 0) points.push(acc)
  })

  if (points.at(-1) !== acc) points.push(acc)
  return points.length > 1 ? points : [0, acc]
}

interface LatestState {
  upload: UploadSummary | null
  rebates: MonthlyRebateDTO[]
  anomalies: AnomalyDTO[]
  stats: ReconciliationStats | null
}

// Orden canónico de niveles para la distribución.
const TIER_ORDER = ['Base', 'Bronce', 'Plata', 'Oro', 'Platino']
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

    const sorted = [...state.rebates].sort(
      (a, b) => Number(b.rebateUSDT) - Number(a.rebateUSDT),
    )
    const transactionSorted = [...state.rebates].sort(
      (a, b) => b.transactionCount - a.transactionCount,
    )

    return {
      rebateUSDT,
      rebateBOB,
      averageTicket: transactions === 0 ? 0 : spentBOB / transactions,
      transactions,
      buckets,
      curve: cumulativeCurve(sorted.map((row) => Number(row.rebateUSDT)), 24),
      userCurve: cumulativeCurve(state.rebates.map(() => 1), 18),
      transactionCurve: cumulativeCurve(transactionSorted.map((row) => row.transactionCount), 18),
    }
  }, [state.rebates])

  const animRebate = useCounter(derived.rebateUSDT, 1300)
  const animUsers = useCounter(state.rebates.length, 900)
  const animTicket = useCounter(derived.averageTicket, 1100)
  const animAnom = useCounter(state.stats?.total ?? state.anomalies.length, 900)

  if (status === 'loading') {
    return <LatestResultsSkeleton />
  }

  if (status === 'empty') {
    return (
      <EmptyState
        title="Todavía no hay archivos procesados"
        description="Sube el Excel mensual de pagos QR para activar el cálculo de reintegros, la conciliación bancaria y las descargas operativas."
      />
    )
  }

  if (status === 'error') {
    return (
      <div aria-live="polite">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>No se pudieron cargar los resultados</AlertTitle>
          <AlertDescription>Revisa la conexión con la API o inténtalo nuevamente.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const reconciliationRate = Number(state.stats?.reconciliationRate ?? 0)
  const anomalyTotal = state.stats?.total ?? state.anomalies.length
  const parseErrors = state.upload?.parseErrorCount ?? 0
  const anomalyCurve = [
    0,
    state.stats?.noQr ?? 0,
    (state.stats?.noQr ?? 0) + (state.stats?.noExtract ?? 0),
    anomalyTotal,
  ]

  return (
    <TooltipProvider delayDuration={120}>
      <div className="stagger space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Reintegrado"
            value={money(animRebate, 2)}
            suffix="USDT"
            secondary={`Bs ${money(derived.rebateBOB, 0)}`}
            icon={<CircleDollarSign className="size-4" />}
            accent="primary"
            spark={derived.curve}
            tooltip="Monto total estimado del reintegro del período, expresado en USDT y su referencia en bolivianos."
          />
          <KpiCard
            label="Usuarios beneficiados"
            value={integer(Math.round(animUsers))}
            secondary={`ticket prom. Bs ${money(derived.averageTicket, 0)}`}
            icon={<Users className="size-4" />}
            accent="emerald"
            spark={derived.userCurve}
            tooltip="Cantidad de usuarios que calificaron para reintegro en el cierre actual."
          />
          <KpiCard
            label="Transacciones QR"
            value={integer(derived.transactions)}
            secondary={`T/C ${money(animTicket)}`}
            icon={<FileSpreadsheet className="size-4" />}
            accent="violet"
            spark={derived.transactionCurve}
            tooltip="Total de transacciones QR consideradas en el cálculo del período."
          />
          <KpiCard
            label="Anomalías abiertas"
            value={integer(Math.round(animAnom))}
            secondary={`conciliación ${reconciliationRate.toFixed(2)}%`}
            icon={<ShieldAlert className="size-4" />}
            accent={anomalyTotal > 0 ? 'amber' : 'emerald'}
            spark={anomalyCurve}
            tooltip="Incidencias pendientes de conciliación entre pagos QR y extractos bancarios."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="top">
              Evolución acumulada del reintegro total a medida que avanza el cierre.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="top">
              Reparto de usuarios según el nivel de cashback asignado en el período.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Tooltip>
            <TooltipTrigger asChild>
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
                    {formatPeriodLabel(state.upload?.period)}
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="secondary" size="sm">
                          <a href={`/uploads/result?id=${encodeURIComponent(state.upload?.id ?? '')}`}>
                            Ver resultados
                            <ArrowUpRight />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Abrir detalle completo del archivo procesado
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="ghost" size="sm">
                          <a href="/reconciliation">Ir a conciliación</a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Revisar anomalías y estado del cruce bancario
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top">
              Resumen del archivo actualmente tomado como referencia para el dashboard.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="top">
              Desglose de incidencias detectadas durante la conciliación del período.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}

function LatestResultsSkeleton() {
  return (
    <div className="stagger space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {['bg-primary', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'].map((accent, idx) => (
          <Card
            key={accent}
            className="relative min-h-[120px] overflow-hidden border-border/70 bg-[linear-gradient(180deg,oklch(0.22_0.018_280/0.94),oklch(0.17_0.017_280/0.98))] py-0"
          >
            <div className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.04] to-transparent" />
            <CardContent className="relative flex min-h-[120px] flex-col justify-between gap-3 px-5 py-4 pl-7">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28 bg-white/10" />
                  {idx === 1 ? <Skeleton className="h-3 w-20 bg-white/10" /> : null}
                </div>
                <Skeleton className="size-7 rounded-md bg-white/10" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-8 w-32 bg-white/10" />
                <Skeleton className="h-3 w-24 bg-white/10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="relative h-[220px]">
              <div className="absolute inset-x-10 inset-y-6 flex flex-col justify-between">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-px w-full rounded-none opacity-60" />
                ))}
              </div>
              <Skeleton className="absolute bottom-6 left-10 h-[64%] w-[88%] rounded-xl bg-primary/10" />
              <Skeleton className="absolute bottom-[66px] left-20 h-1.5 w-[76%] rounded-full bg-primary/25" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[12px_minmax(48px,64px)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[16px_64px_1fr_56px] sm:gap-3"
              >
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-10 justify-self-end" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type Accent = 'primary' | 'emerald' | 'violet' | 'amber'

const ACCENT_STYLES: Record<
  Accent,
  { edge: string; glow: string; icon: string; ring: string; stroke: string; tint: string }
> = {
  primary: {
    edge: 'bg-primary',
    glow: 'bg-primary/20',
    icon: 'bg-primary/15 text-primary',
    ring: 'ring-primary/25',
    stroke: 'var(--primary)',
    tint: 'from-primary/18',
  },
  emerald: {
    edge: 'bg-emerald-500',
    glow: 'bg-emerald-500/20',
    icon: 'bg-emerald-500/15 text-emerald-400',
    ring: 'ring-emerald-500/25',
    stroke: '#10b981',
    tint: 'from-emerald-500/18',
  },
  violet: {
    edge: 'bg-violet-500',
    glow: 'bg-violet-500/20',
    icon: 'bg-violet-500/15 text-violet-400',
    ring: 'ring-violet-500/25',
    stroke: '#8b5cf6',
    tint: 'from-violet-500/18',
  },
  amber: {
    edge: 'bg-amber-500',
    glow: 'bg-amber-500/20',
    icon: 'bg-amber-500/15 text-amber-400',
    ring: 'ring-amber-500/25',
    stroke: '#f59e0b',
    tint: 'from-amber-500/18',
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
  tooltip,
}: {
  label: string
  value: string
  suffix?: string
  secondary?: string
  icon: React.ReactNode
  accent: Accent
  spark?: number[]
  tooltip: string
}) {
  const styles = ACCENT_STYLES[accent]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="group relative min-h-[120px] overflow-hidden border-border/70 bg-[linear-gradient(180deg,oklch(0.22_0.018_280/0.94),oklch(0.17_0.017_280/0.98))] py-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_-32px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5">
          <div className={`absolute inset-y-0 left-0 w-1.5 ${styles.edge}`} />
          <div className={`pointer-events-none absolute -left-8 top-0 size-20 rounded-full blur-3xl ${styles.glow}`} />
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${styles.tint} to-transparent opacity-70`} />
          {spark && spark.length > 1 ? (
            <div className="pointer-events-none absolute right-4 top-2 hidden opacity-70 transition-opacity group-hover:opacity-100 sm:block">
              <Sparkline data={spark} stroke={styles.stroke} w={104} h={32} />
            </div>
          ) : null}
          <CardContent className="relative flex min-h-[120px] flex-col justify-between gap-3 px-5 py-4 pl-7">
            <div className="flex items-center justify-between">
              <p className="max-w-[13rem] text-[11px] font-semibold uppercase leading-4 text-muted-foreground">
                {label}
              </p>
              <span
                className={`flex size-7 items-center justify-center rounded-md ring-1 ${styles.icon} ${styles.ring}`}
              >
                {icon}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex min-w-0 items-end gap-2">
                <p className="min-w-0 truncate font-mono text-[28px] font-semibold leading-none tabular-nums text-foreground md:text-[32px]">
                  {value}
                </p>
                {suffix ? (
                  <span className="pb-1 text-[11px] font-semibold uppercase text-muted-foreground">{suffix}</span>
                ) : null}
              </div>
              {secondary ? (
                <p className="font-mono text-xs font-medium tabular-nums text-muted-foreground">{secondary}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function Sparkline({
  data,
  stroke,
  w = 124,
  h = 44,
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
        const color = getLevelColor(b.name)
        return (
          <div
            key={b.name}
            className="grid grid-cols-[minmax(92px,120px)_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3"
          >
            <LevelBadge levelName={b.name} variant="dot" />
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
