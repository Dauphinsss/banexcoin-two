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
    const rebateBOB = state.rebates.reduce((sum, row) => sum + Number(row.rebateBOB), 0)
    const rebateUSDT = state.rebates.reduce((sum, row) => sum + Number(row.rebateUSDT), 0)
    const spentBOB = state.rebates.reduce((sum, row) => sum + Number(row.totalSpentBOB), 0)
    const transactions = state.rebates.reduce((sum, row) => sum + row.transactionCount, 0)

    return {
      rebateBOB,
      rebateUSDT,
      averageTicket: transactions === 0 ? 0 : spentBOB / transactions,
    }
  }, [state.rebates])

  if (status === 'loading') {
    return <div className="text-sm text-muted">Cargando resultados...</div>
  }

  if (status === 'empty') {
    return (
      <div className="rounded-lg border border-line bg-panel p-6">
        <p className="text-sm text-muted">Todavía no hay uploads procesados.</p>
        <a className="mt-4 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-inverse hover-bg-brand-hover" href="/uploads/new">
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
        <Kpi label="Anomalías" value={String(state.stats?.total ?? state.anomalies.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-main">Último procesamiento</h2>
              <p className="mt-1 text-sm text-muted">{state.upload?.filename}</p>
            </div>
            <span className="rounded-md border border-success-muted bg-success-soft px-3 py-1 text-xs font-medium text-success">
              {state.upload?.period ?? 'Sin período'}
            </span>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <Metric label="Filas QR" value={String(state.upload?.rowCount ?? 0)} />
            <Metric label="Parse errors" value={String(state.upload?.parseErrorCount ?? 0)} />
            <Metric label="Conciliación" value={`${state.stats?.reconciliationRate ?? '0.00'}%`} />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-base font-semibold text-main">Anomalías</h2>
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
    <div className="rounded-lg border border-line bg-panel-strong p-4">
      <p className="text-xs uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-main">{value}</p>
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
