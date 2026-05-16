import { useEffect, useMemo, useState } from 'react'
import type { AnomalyDTO, ReconciliationStats, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

const labels: Record<AnomalyDTO['type'], string> = {
  NO_EXTRACT: 'Sin extracto',
  NO_QR: 'Sin QR',
  AMOUNT_MISMATCH: 'Monto distinto',
  INVALID_RATE: 'T/C inválido',
}

export function AnomalyPanel() {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [stats, setStats] = useState<ReconciliationStats | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>([])
  const [type, setType] = useState<'ALL' | AnomalyDTO['type']>('ALL')
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const uploads = await api.listUploads()
        const latest = uploads.find((item) => item.status === 'DONE') ?? null
        if (!latest) {
          if (!cancelled) setStatus('empty')
          return
        }

        const [nextStats, rows] = await Promise.all([
          api.reconciliationStats(latest.id),
          api.listAnomalies(latest.id),
        ])
        if (!cancelled) {
          setUpload(latest)
          setStats(nextStats)
          setAnomalies(rows)
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

  const filtered = useMemo(
    () => anomalies.filter((row) => type === 'ALL' || row.type === type),
    [anomalies, type],
  )

  if (status === 'loading') return <p className="text-sm text-slate-400">Cargando conciliación...</p>
  if (status === 'empty') return <p className="text-sm text-slate-300">Procesa un Excel para ver anomalías.</p>
  if (status === 'error') return <p className="text-sm text-red-300">No se pudo cargar la conciliación.</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-slate-400">Upload conciliado</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">{upload?.filename}</h2>
        </div>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-sm text-emerald-200">
          {stats?.reconciliationRate ?? '0.00'}% conciliado
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Badge label="Total" value={stats?.total ?? 0} active={type === 'ALL'} onClick={() => setType('ALL')} />
        <Badge label="Sin extracto" value={stats?.noExtract ?? 0} active={type === 'NO_EXTRACT'} onClick={() => setType('NO_EXTRACT')} />
        <Badge label="Sin QR" value={stats?.noQr ?? 0} active={type === 'NO_QR'} onClick={() => setType('NO_QR')} />
        <Badge label="Monto distinto" value={stats?.amountMismatch ?? 0} active={type === 'AMOUNT_MISMATCH'} onClick={() => setType('AMOUNT_MISMATCH')} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Transacción</th>
              <th className="px-4 py-3 text-right">QR BOB</th>
              <th className="px-4 py-3 text-right">Extracto BOB</th>
              <th className="px-4 py-3 text-right">Delta</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 bg-slate-900/30">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>No hay anomalías para este filtro.</td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3 text-slate-200">{labels[row.type]}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.transactionId}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{row.qrAmountBOB ?? '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{row.extractAmountBOB ?? '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-200">{row.deltaBOB ?? '-'}</td>
                <td className="px-4 py-3 text-slate-300">{row.resolved ? 'Resuelta' : 'Pendiente'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Badge({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-lg border p-4 text-left transition-colors ${
        active
          ? 'border-blue-500/50 bg-blue-500/15'
          : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50'
      }`}
      type="button"
      onClick={onClick}
    >
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">{value}</p>
    </button>
  )
}
