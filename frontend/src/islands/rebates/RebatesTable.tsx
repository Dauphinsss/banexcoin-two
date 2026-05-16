import { useEffect, useMemo, useState, type JSX } from 'react'
import type { MonthlyRebateDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import {
  formatBOB,
  formatPercent,
  formatRate,
  formatUSDT,
} from '../../lib/format'
import { UserDrawer } from './UserDrawer'

type SortKey =
  | 'username'
  | 'totalSpentBOB'
  | 'tierName'
  | 'rebatePercent'
  | 'rebateUSDT'
  | 'avgExchangeRate'
  | 'transactionCount'

type SortDir = 'asc' | 'desc'

export function RebatesTable(): JSX.Element {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [rebates, setRebates] = useState<MonthlyRebateDTO[]>([])
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('rebateUSDT')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [selected, setSelected] = useState<MonthlyRebateDTO | null>(null)

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

  const filteredSorted = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = rebates.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.username.toLowerCase().includes(normalizedQuery) ||
        String(row.userId).includes(normalizedQuery)
      const matchesTier = tier === 'ALL' || (row.tierName ?? 'Sin nivel') === tier
      return matchesQuery && matchesTier
    })

    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDir))
  }, [rebates, query, tier, sortKey, sortDir])

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'username' || key === 'tierName' ? 'asc' : 'desc')
    }
  }

  const exportCSV = (): void => {
    const csv = buildCSV(filteredSorted)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const periodTag = upload?.period ?? 'reintegros'
    a.href = url
    a.download = `BanexReintegra-${periodTag}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (status === 'loading') return <RebatesTableSkeleton />
  if (status === 'empty') return <EmptyState />
  if (status === 'error') return <p className="text-sm text-danger">No se pudieron cargar los reintegros.</p>

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-muted">Último upload procesado</p>
            <h2 className="mt-1 text-base font-semibold text-main">{upload?.filename}</h2>
            <p className="text-xs text-faint font-mono mt-1">
              {filteredSorted.length} de {rebates.length} reintegros
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="h-10 rounded-md border border-line-strong bg-app px-3 text-sm text-main outline-none focus-border-brand"
              placeholder="Buscar usuario o cuenta"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 rounded-md border border-line-strong bg-app px-3 text-sm text-main outline-none focus-border-brand"
              value={tier}
              onChange={(event) => setTier(event.target.value)}
            >
              {tiers.map((item) => (
                <option key={item} value={item}>
                  {item === 'ALL' ? 'Todos los niveles' : item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredSorted.length === 0}
              className="h-10 px-4 rounded-md border border-line-strong bg-panel-solid text-sm text-soft hover-bg-chart-track disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Exportar ${filteredSorted.length} filas a CSV`}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-line">
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="sticky top-0 bg-app text-left text-xs uppercase tracking-widest text-faint z-10">
                <tr>
                  <SortHeader label="Usuario" sortKey="username" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Total BOB" sortKey="totalSpentBOB" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Nivel" sortKey="tierName" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="%" sortKey="rebatePercent" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="USDT" sortKey="rebateUSDT" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="T/C ⌀" sortKey="avgExchangeRate" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Tx" sortKey="transactionCount" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-dark bg-panel-muted">
                {filteredSorted.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={7}>
                      No hay reintegros que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredSorted.map((row) => (
                    <tr
                      key={row.id}
                      className="hover-bg-panel-hover cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-main">{row.username}</div>
                        <div className="font-mono text-xs text-faint">{row.userId}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-soft">
                        {formatBOB(row.totalSpentBOB)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-brand-muted bg-brand-soft px-2 py-1 text-xs text-brand-soft">
                          {row.tierName ?? 'Sin nivel'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-soft">
                        {formatPercent(row.rebatePercent)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-success">
                        {formatUSDT(row.rebateUSDT)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                        {formatRate(row.avgExchangeRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                        {row.transactionCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {upload && (
        <UserDrawer
          uploadId={upload.id}
          rebate={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

const SortHeader = ({
  label,
  sortKey: key,
  active,
  dir,
  align = 'left',
  onSort,
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  align?: 'left' | 'right'
  onSort: (key: SortKey) => void
}): JSX.Element => {
  const isActive = active === key
  const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : ''
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`inline-flex items-center gap-1 hover-text-soft ${
          isActive ? 'text-soft' : ''
        }`}
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  )
}

function EmptyState(): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="text-sm text-muted">Procesa un Excel para ver la tabla de reintegros.</p>
      <a
        className="mt-4 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-inverse hover-bg-brand-hover"
        href="/uploads/new"
      >
        Subir Excel
      </a>
    </div>
  )
}

function RebatesTableSkeleton(): JSX.Element {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="h-4 w-36 rounded skeleton-block" />
          <div className="mt-3 h-5 w-72 max-w-full rounded skeleton-block" />
          <div className="mt-2 h-3 w-32 rounded skeleton-block" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="h-10 w-full rounded-md skeleton-block sm:w-56" />
          <div className="h-10 w-full rounded-md skeleton-block sm:w-44" />
          <div className="h-10 w-full rounded-md skeleton-block sm:w-32" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-app text-left text-xs uppercase tracking-widest text-faint">
            <tr>
              {['Usuario', 'Total BOB', 'Nivel', '%', 'USDT', 'T/C', 'Tx'].map((label, index) => (
                <th key={label} className={`px-4 py-3 ${index === 0 || index === 2 ? 'text-left' : 'text-right'}`}>
                  <div className={`h-3 rounded skeleton-block ${index === 0 ? 'w-20' : 'ml-auto w-14'}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-dark bg-panel-muted">
            {Array.from({ length: 7 }).map((_, row) => (
              <tr key={row}>
                <td className="px-4 py-3">
                  <div className="h-4 w-36 rounded skeleton-block" />
                  <div className="mt-2 h-3 w-20 rounded skeleton-block" />
                </td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-24 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="h-6 w-20 rounded-md skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-12 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-24 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-8 rounded skeleton-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const compare = (
  a: MonthlyRebateDTO,
  b: MonthlyRebateDTO,
  key: SortKey,
  dir: SortDir,
): number => {
  const sign = dir === 'asc' ? 1 : -1

  switch (key) {
    case 'username':
      return sign * a.username.localeCompare(b.username, 'es-BO')
    case 'tierName':
      return sign * (a.tierName ?? '').localeCompare(b.tierName ?? '', 'es-BO')
    case 'totalSpentBOB':
      return sign * (Number.parseFloat(a.totalSpentBOB) - Number.parseFloat(b.totalSpentBOB))
    case 'rebatePercent':
      return sign * (Number.parseFloat(a.rebatePercent) - Number.parseFloat(b.rebatePercent))
    case 'rebateUSDT':
      return sign * (Number.parseFloat(a.rebateUSDT) - Number.parseFloat(b.rebateUSDT))
    case 'avgExchangeRate':
      return sign * (Number.parseFloat(a.avgExchangeRate) - Number.parseFloat(b.avgExchangeRate))
    case 'transactionCount':
      return sign * (a.transactionCount - b.transactionCount)
    default:
      return 0
  }
}

const buildCSV = (rows: MonthlyRebateDTO[]): string => {
  const headers = [
    'Cuenta',
    'Usuario',
    'Período',
    'Total BOB',
    'Nivel',
    '% Cashback',
    'Reintegro USDT',
    'Reintegro BOB',
    'T/C promedio',
    'Transacciones',
    'Pagado',
  ]
  const lines = [headers.join(',')]

  for (const row of rows) {
    lines.push(
      [
        row.userId,
        csvCell(row.username),
        row.period,
        row.totalSpentBOB,
        csvCell(row.tierName ?? 'Sin nivel'),
        row.rebatePercent,
        row.rebateUSDT,
        row.rebateBOB,
        row.avgExchangeRate,
        row.transactionCount,
        row.paidOut ? 'Sí' : 'No',
      ].join(','),
    )
  }

  return '﻿' + lines.join('\r\n')
}

const csvCell = (value: string): string => {
  // CSV injection prevention (CONVENTIONS.md sección 7.5)
  // y escape de comas/comillas
  const needsQuote = /[",\r\n=+\-@]/.test(value)
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return needsQuote ? `"${safe.replace(/"/g, '""')}"` : safe
}
