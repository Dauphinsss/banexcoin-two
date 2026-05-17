import { useEffect, useMemo, useState, type JSX } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowRight, ChevronDown, Download, Search } from 'lucide-react'
import type { MonthlyRebateDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { formatBOB, formatPercent, formatRate, formatUSDT } from '../../lib/format'
import { UserDrawer } from './UserDrawer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type SortKey =
  | 'username'
  | 'totalSpentBOB'
  | 'tierName'
  | 'rebatePercent'
  | 'rebateUSDT'
  | 'avgExchangeRate'
  | 'transactionCount'

type SortDir = 'asc' | 'desc'

interface RebatesTableProps {
  uploadId?: string
}

export function RebatesTable({ uploadId }: RebatesTableProps): JSX.Element {
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
        const targetUpload = uploadId
          ? await api.getUpload(uploadId)
          : (await api.listUploads()).find((item) => item.status === 'DONE') ?? null

        if (!targetUpload || targetUpload.status !== 'DONE') {
          if (!cancelled) setStatus('empty')
          return
        }

        const rows = await api.listRebates(targetUpload.id)
        if (!cancelled) {
          setUpload(targetUpload)
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
  }, [uploadId])

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

  if (status === 'loading') {
    return <RebatesTableSkeleton />
  }
  if (status === 'empty') return <EmptyState />
  if (status === 'error') {
    return (
      <div aria-live="polite">
        <Alert variant="destructive">
          <AlertDescription>No se pudieron cargar los reintegros.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Último archivo procesado
              </p>
              <h2 className="truncate text-base font-semibold">{upload?.filename}</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {filteredSorted.length} de {rebates.length} reintegros
                {upload?.period ? ` · período ${upload.period}` : null}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  name="rebate-search"
                  aria-label="Buscar usuario o cuenta"
                  autoComplete="off"
                  spellCheck={false}
                  className="pl-9"
                  placeholder="Buscar usuario o cuenta…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="relative min-w-0 sm:w-44">
                <select
                  aria-label="Filtrar por nivel"
                  name="rebate-tier-filter"
                  className="h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] transition-[color,box-shadow,border-color] outline-none hover:border-ring/60 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 dark:bg-input/30"
                  value={tier}
                  onChange={(event) => setTier(event.target.value)}
                >
                  {tiers.map((item) => (
                    <option key={item} value={item} className="bg-popover text-popover-foreground">
                      {item === 'ALL' ? 'Todos los niveles' : item}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={exportCSV}
                disabled={filteredSorted.length === 0}
                title={`Exportar ${filteredSorted.length} filas a CSV`}
              >
                <Download />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="max-h-[620px] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <SortHeader label="Usuario" sortKey="username" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Total BOB" sortKey="totalSpentBOB" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Nivel" sortKey="tierName" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="%" sortKey="rebatePercent" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="USDT" sortKey="rebateUSDT" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="T/C ⌀" sortKey="avgExchangeRate" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Tx" sortKey="transactionCount" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay reintegros que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSorted.map((row) => (
                    <TableRow
                      key={row.id}
                      className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver detalle de ${row.username}`}
                      onClick={() => setSelected(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelected(row)
                        }
                      }}
                    >
                      <TableCell>
                        <p className="font-medium text-foreground">{row.username}</p>
                        <p className="font-mono text-xs text-muted-foreground">{row.userId}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatBOB(row.totalSpentBOB)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          {row.tierName ?? 'Sin nivel'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatPercent(row.rebatePercent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-400">
                        {formatUSDT(row.rebateUSDT)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {formatRate(row.avgExchangeRate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {row.transactionCount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
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
  const Arrow = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === 'right' ? 'text-right' : 'text-left'}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className={cn(
          'inline-flex items-center gap-1 text-xs uppercase tracking-wider transition-colors hover:text-foreground',
          isActive ? 'text-foreground' : 'text-muted-foreground',
          align === 'right' ? 'flex-row-reverse' : '',
        )}
      >
        {label}
        <Arrow className="size-3" />
      </button>
    </TableHead>
  )
}

function EmptyState(): JSX.Element {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <p className="text-sm text-muted-foreground">Procesa un Excel para ver la tabla de reintegros.</p>
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

function RebatesTableSkeleton(): JSX.Element {
  const columns = [
    { key: 'user', align: 'left' as const },
    { key: 'bob', align: 'right' as const },
    { key: 'tier', align: 'left' as const },
    { key: 'pct', align: 'right' as const },
    { key: 'usdt', align: 'right' as const },
    { key: 'rate', align: 'right' as const },
    { key: 'tx', align: 'right' as const },
  ]

  return (
    <div className="space-y-4" aria-hidden="true">
      {/* Espejo del toolbar Card real */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-64 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Skeleton className="h-9 w-full rounded-md sm:w-64" />
            <Skeleton className="h-9 w-full rounded-md sm:w-44" />
            <Skeleton className="h-9 w-full rounded-md sm:w-36" />
          </div>
        </CardContent>
      </Card>

      {/* Espejo de la tabla Card real */}
      <Card>
        <div className="max-h-[620px] overflow-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.align === 'right' ? 'text-right' : 'text-left'}
                  >
                    <Skeleton
                      className={cn('h-3 w-14', col.align === 'right' && 'ml-auto')}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-12" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
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
  const needsQuote = /[",\r\n=+\-@]/.test(value)
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return needsQuote ? `"${safe.replace(/"/g, '""')}"` : safe
}
