import { useEffect, useMemo, useState, type JSX } from 'react'
import type { AnomalyDTO, ReconciliationStats, UploadSummary } from '@banex/types'
import { api, ApiCallError } from '../../lib/api'

const labels: Record<AnomalyDTO['type'], string> = {
  NO_EXTRACT: 'Sin extracto',
  NO_QR: 'Sin QR',
  AMOUNT_MISMATCH: 'Monto distinto',
  INVALID_RATE: 'T/C inválido',
}

export function AnomalyPanel(): JSX.Element {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [stats, setStats] = useState<ReconciliationStats | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>([])
  const [type, setType] = useState<'ALL' | AnomalyDTO['type']>('ALL')
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [resolving, setResolving] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
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

  const handleResolve = async (anomalyId: string): Promise<void> => {
    try {
      const updated = await api.resolveAnomaly(anomalyId, resolveNote.trim() || undefined)
      setAnomalies((prev) => prev.map((a) => (a.id === anomalyId ? updated : a)))
      setResolving(null)
      setResolveNote('')
      setFeedback({ kind: 'success', message: 'Anomalía marcada como resuelta.' })
    } catch (error) {
      const message =
        error instanceof ApiCallError
          ? error.payload.message
          : error instanceof Error
            ? error.message
            : 'No se pudo resolver la anomalía.'
      setFeedback({ kind: 'error', message })
    }
  }

  const exportCSV = (): void => {
    const csv = buildAnomaliesCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const tag = upload?.period ?? 'anomalias'
    a.href = url
    a.download = `BanexReintegra-Anomalias-${tag}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-sm text-emerald-200">
            {stats?.reconciliationRate ?? '0.00'}% conciliado
          </div>
          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="h-10 px-4 rounded-md border border-slate-700 bg-slate-900 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Badge label="Total" value={stats?.total ?? 0} active={type === 'ALL'} onClick={() => setType('ALL')} />
        <Badge label="Sin extracto" value={stats?.noExtract ?? 0} active={type === 'NO_EXTRACT'} onClick={() => setType('NO_EXTRACT')} tone="red" />
        <Badge label="Sin QR" value={stats?.noQr ?? 0} active={type === 'NO_QR'} onClick={() => setType('NO_QR')} tone="amber" />
        <Badge label="Monto distinto" value={stats?.amountMismatch ?? 0} active={type === 'AMOUNT_MISMATCH'} onClick={() => setType('AMOUNT_MISMATCH')} tone="orange" />
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
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 bg-slate-900/30">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                  No hay anomalías para este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 align-top">
                  <td className="px-4 py-3 text-slate-200">{labels[row.type]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.transactionId}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                    {row.qrAmountBOB ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                    {row.extractAmountBOB ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-200">
                    {row.deltaBOB ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.resolved ? (
                      <span className="text-emerald-300 text-xs">
                        ✓ Resuelta
                        {row.resolvedNote ? (
                          <span className="block font-mono text-slate-500 text-[11px] truncate max-w-[200px]" title={row.resolvedNote}>
                            "{row.resolvedNote}"
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-amber-200 text-xs">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.resolved ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : resolving === row.id ? (
                      <div className="flex flex-col gap-2 items-end">
                        <input
                          type="text"
                          autoFocus
                          value={resolveNote}
                          onChange={(e) => setResolveNote(e.target.value)}
                          placeholder="Motivo (opcional)"
                          className="w-48 h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setResolving(null)
                              setResolveNote('')
                            }}
                            className="px-2 h-7 text-xs text-slate-300 hover:text-slate-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleResolve(row.id)}
                            className="px-2 h-7 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setResolving(row.id)
                          setResolveNote('')
                          setFeedback(null)
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Marcar resuelta
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
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
  tone = 'default',
}: {
  label: string
  value: number
  active: boolean
  onClick: () => void
  tone?: 'default' | 'red' | 'amber' | 'orange'
}): JSX.Element {
  const toneClasses: Record<typeof tone, string> = {
    default: active ? 'border-blue-500/50 bg-blue-500/15' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50',
    red: active ? 'border-red-500/50 bg-red-500/15' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50',
    amber: active ? 'border-amber-500/50 bg-amber-500/15' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50',
    orange: active ? 'border-orange-500/50 bg-orange-500/15' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50',
  }
  return (
    <button
      className={`rounded-lg border p-4 text-left transition-colors ${toneClasses[tone]}`}
      type="button"
      onClick={onClick}
    >
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
    </button>
  )
}

const buildAnomaliesCSV = (rows: AnomalyDTO[]): string => {
  const headers = [
    'Tipo',
    'Transaction ID',
    'QR BOB',
    'Extracto BOB',
    'Delta BOB',
    'Resuelta',
    'Nota',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        labels[row.type] ?? row.type,
        csvCell(row.transactionId),
        row.qrAmountBOB ?? '',
        row.extractAmountBOB ?? '',
        row.deltaBOB ?? '',
        row.resolved ? 'Sí' : 'No',
        csvCell(row.resolvedNote ?? ''),
      ].join(','),
    )
  }
  return '﻿' + lines.join('\r\n')
}

const csvCell = (value: string): string => {
  const needsQuote = /[",\r\n=+\-@]/.test(value)
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return needsQuote ? `"${safe.replace(/"/g, '""')}"` : safe
}
