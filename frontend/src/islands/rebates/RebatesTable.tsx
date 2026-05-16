import { useEffect, useMemo, useState } from 'react'
import type { MonthlyRebateDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

const money = (value: string, fractionDigits = 2) =>
  Number(value).toLocaleString('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

export function RebatesTable() {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [rebates, setRebates] = useState<MonthlyRebateDTO[]>([])
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState('ALL')
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

        const rows = await api.listRebates(latest.id)
        if (!cancelled) {
          setUpload(latest)
          setRebates(rows)
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

  const tiers = useMemo(
    () => ['ALL', ...Array.from(new Set(rebates.map((row) => row.tierName ?? 'Sin nivel')))],
    [rebates],
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return rebates.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.username.toLowerCase().includes(normalizedQuery) ||
        String(row.userId).includes(normalizedQuery)
      const matchesTier = tier === 'ALL' || (row.tierName ?? 'Sin nivel') === tier
      return matchesQuery && matchesTier
    })
  }, [rebates, query, tier])

  if (status === 'loading') return <p className="text-sm text-slate-400">Cargando reintegros...</p>
  if (status === 'empty') return <EmptyState />
  if (status === 'error') return <p className="text-sm text-red-300">No se pudieron cargar los reintegros.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-slate-400">Último upload procesado</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">{upload?.filename}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-blue-500"
            placeholder="Buscar usuario o cuenta"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-blue-500"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          >
            {tiers.map((item) => (
              <option key={item} value={item}>{item === 'ALL' ? 'Todos los niveles' : item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="sticky top-0 bg-slate-950 text-left text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3 text-right">Total BOB</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">USDT</th>
                <th className="px-4 py-3 text-right">T/C</th>
                <th className="px-4 py-3 text-right">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 bg-slate-900/30">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{row.username}</div>
                    <div className="font-mono text-xs text-slate-500">{row.userId}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">{money(row.totalSpentBOB)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs text-blue-200">
                      {row.tierName ?? 'Sin nivel'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">{money(row.rebatePercent)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-200">{money(row.rebateUSDT, 8)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{money(row.avgExchangeRate, 8)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{row.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <p className="text-sm text-slate-300">Procesa un Excel para ver la tabla de reintegros.</p>
      <a className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500" href="/uploads/new">
        Subir Excel
      </a>
    </div>
  )
}
