import { useEffect, useMemo, useState } from 'react'
import type { AnomalyDTO, MonthlyRebateDTO, ReconciliationStats, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

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
    }
  }, [state.rebates])

  if (status === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {['Reintegrado', 'Usuarios', 'Ticket promedio', 'Anomalias'].map((label) => (
          <div key={label} className="rounded-lg border surface-card-quiet p-4">
            <div className="h-3 w-24 rounded bg-panel-hover" />
            <div className="mt-4 h-6 w-32 rounded bg-panel-hover" />
          </div>
        ))}
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="rounded-lg border surface-card p-6">
        <p className="text-base font-medium text-main">Todavia no hay uploads procesados.</p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Sube el Excel mensual para activar el calculo de reintegros, conciliacion
          y descargas operativas.
        </p>
        <a className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-inverse" href="/uploads/new">
          Subir Excel
        </a>
      </div>
    )
  }

  if (status === 'error') {
    return <div className="text-sm text-danger">No se pudieron cargar los resultados.</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Reintegrado" value={`${money(totals.rebateUSDT, 8)} USDT`} />
        <Kpi label="Usuarios" value={String(state.rebates.length)} />
        <Kpi label="Ticket promedio" value={`${money(totals.averageTicket)} BOB`} />
        <Kpi label="Anomalias" value={String(state.stats?.total ?? state.anomalies.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border surface-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-faint">Archivo activo</p>
              <h2 className="mt-1 text-base font-semibold text-main">Ultimo procesamiento</h2>
              <p className="mt-1 text-sm text-muted">{state.upload?.filename}</p>
            </div>
            <span className="rounded-md border border-success-muted bg-success-soft px-3 py-1 text-xs font-medium text-success">
              {state.upload?.period ?? 'Sin periodo'}
            </span>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <Metric label="Filas QR" value={String(state.upload?.rowCount ?? 0)} />
            <Metric label="Parse errors" value={String(state.upload?.parseErrorCount ?? 0)} />
            <Metric label="Conciliacion" value={`${state.stats?.reconciliationRate ?? '0.00'}%`} />
          </div>
        </section>

        <section className="rounded-lg border surface-card p-5">
          <p className="text-xs uppercase tracking-widest text-faint">Riesgo operativo</p>
          <h2 className="mt-1 text-base font-semibold text-main">Anomalias</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Metric label="Sin extracto" value={String(state.stats?.noExtract ?? 0)} />
            <Metric label="Sin QR" value={String(state.stats?.noQr ?? 0)} />
            <Metric label="Monto distinto" value={String(state.stats?.amountMismatch ?? 0)} />
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border surface-card p-4 transition-transform hover:-translate-y-0.5">
      <div className="mb-4 h-1 w-10 rounded-full bg-brand" />
      <p className="text-xs uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-main md:text-2xl">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-panel-inset-strong px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-main">{value}</span>
    </div>
  )
}
