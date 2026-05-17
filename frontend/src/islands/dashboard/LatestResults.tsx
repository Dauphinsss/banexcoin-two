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

interface LatestState {
  upload: UploadSummary | null
  rebates: MonthlyRebateDTO[]
  anomalies: AnomalyDTO[]
  stats: ReconciliationStats | null
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

  const totals = useMemo(() => {
    const rebateUSDT = state.rebates.reduce((sum, row) => sum + Number(row.rebateUSDT), 0)
    const spentBOB = state.rebates.reduce((sum, row) => sum + Number(row.totalSpentBOB), 0)
    const transactions = state.rebates.reduce((sum, row) => sum + row.transactionCount, 0)

    return {
      rebateUSDT,
      averageTicket: transactions === 0 ? 0 : spentBOB / transactions,
      transactions,
    }
  }, [state.rebates])

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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Reintegrado"
          value={`${money(totals.rebateUSDT, 4)}`}
          suffix="USDT"
          icon={<CircleDollarSign className="size-4" />}
          accent="primary"
        />
        <KpiCard
          label="Usuarios"
          value={String(state.rebates.length)}
          icon={<Users className="size-4" />}
          accent="emerald"
        />
        <KpiCard
          label="Ticket promedio"
          value={money(totals.averageTicket)}
          suffix="BOB"
          icon={<FileSpreadsheet className="size-4" />}
          accent="violet"
        />
        <KpiCard
          label="Anomalías"
          value={String(anomalyTotal)}
          icon={<ShieldAlert className="size-4" />}
          accent={anomalyTotal > 0 ? 'amber' : 'emerald'}
        />
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
              <Metric label="Filas QR" value={String(state.upload?.rowCount ?? 0)} />
              <Metric
                label="Parse errors"
                value={String(parseErrors)}
                tone={parseErrors > 0 ? 'amber' : 'default'}
              />
              <Metric
                label="Transacciones"
                value={totals.transactions.toLocaleString('es-BO')}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Conciliación bancaria
                </p>
                <p className="text-sm font-mono font-medium">
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

const ACCENT_STYLES: Record<Accent, { bar: string; icon: string; ring: string }> = {
  primary: {
    bar: 'bg-primary',
    icon: 'bg-primary/15 text-primary',
    ring: 'ring-primary/25',
  },
  emerald: {
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-500/15 text-emerald-400',
    ring: 'ring-emerald-500/25',
  },
  violet: {
    bar: 'bg-violet-500',
    icon: 'bg-violet-500/15 text-violet-400',
    ring: 'ring-violet-500/25',
  },
  amber: {
    bar: 'bg-amber-500',
    icon: 'bg-amber-500/15 text-amber-400',
    ring: 'ring-amber-500/25',
  },
}

function KpiCard({
  label,
  value,
  suffix,
  icon,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  icon: React.ReactNode
  accent: Accent
}) {
  const styles = ACCENT_STYLES[accent]
  return (
    <Card className="relative overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${styles.bar}`} />
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <span className={`flex size-7 items-center justify-center rounded-md ring-1 ${styles.icon} ${styles.ring}`}>
            {icon}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
        </div>
      </CardContent>
    </Card>
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
