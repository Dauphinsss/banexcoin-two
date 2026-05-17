import { useEffect, useMemo, useState, type JSX } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, Clock3, Download, Filter, Search, X } from 'lucide-react'
import type { MonthlyRebateDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { formatBOB, formatPercent, formatPeriodLabel, formatRate, formatUSDT } from '../../lib/format'
import { UserDrawer } from './UserDrawer'
import { EmptyState } from '../shared/EmptyState'
import { LevelBadge } from '../../components/LevelBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, resolveUploadId } from '@/lib/utils'

type SortKey =
  | 'username'
  | 'totalSpentBOB'
  | 'tierName'
  | 'rebatePercent'
  | 'rebateUSDT'
  | 'avgExchangeRate'
  | 'transactionCount'
  | 'paidOut'

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const resolvedId = resolveUploadId(uploadId)
        const targetUpload = resolvedId
          ? await api.getUpload(resolvedId)
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

  const selectedRows = useMemo(
    () => filteredSorted.filter((row) => selectedIds.has(row.id)),
    [filteredSorted, selectedIds],
  )

  const totals = useMemo(() => getRebateTotals(filteredSorted), [filteredSorted])
  const selectedTotals = useMemo(() => getRebateTotals(selectedRows), [selectedRows])
const allVisibleSelected =
    filteredSorted.length > 0 && filteredSorted.every((row) => selectedIds.has(row.id))

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

  const resetFilters = (): void => {
    setQuery('')
    setTier('ALL')
  }

  const toggleSelected = (id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = (): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        for (const row of filteredSorted) next.delete(row.id)
      } else {
        for (const row of filteredSorted) next.add(row.id)
      }
      return next
    })
  }

  if (status === 'loading') {
    return <RebatesTableSkeleton />
  }
  if (status === 'empty')
    return (
      <EmptyState
        title="Aún no hay reintegros para mostrar"
        description="Procesa el Excel mensual de pagos QR y aquí verás la tabla de reintegros por usuario, con filtros y exportación a CSV."
      />
    )
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
                {upload?.period ? ` · período ${formatPeriodLabel(upload.period)}` : null}
              </p>
            </div>
            <FilterBar
              query={query}
              tier={tier}
              tiers={tiers}
              resultCount={filteredSorted.length}
              totalCount={rebates.length}
              onQueryChange={setQuery}
              onTierChange={setTier}
              onReset={resetFilters}
              onExport={exportCSV}
            />
          </CardContent>
        </Card>

        <TooltipProvider delayDuration={140}>
          <Card className="overflow-hidden">
            <Table
              containerClassName="max-h-[560px] overflow-auto"
              className="min-w-[1080px] table-fixed"
            >
              <TableHeader className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <TableRow className="h-8 hover:bg-transparent">
                  <TableHead className="h-8 w-10 px-3 py-0">
                    <HeaderHint text="Selecciona todas las filas visibles para sumar el total seleccionado.">
                      <input
                        type="checkbox"
                        aria-label={allVisibleSelected ? 'Quitar selección visible' : 'Seleccionar filas visibles'}
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="block size-3.5 rounded border-border bg-background accent-primary"
                      />
                    </HeaderHint>
                  </TableHead>
                  <SortHeader className="w-[260px]" label="Usuario" tooltip="Nombre y cuenta del usuario calculado en el cierre." sortKey="username" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[132px]" label="Total BOB" tooltip="Consumo total del usuario en bolivianos durante el período." sortKey="totalSpentBOB" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[124px]" label="Nivel" tooltip="Nivel de cashback asignado según el consumo mensual." sortKey="tierName" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[72px]" label="%" tooltip="Porcentaje de reintegro aplicado al usuario." sortKey="rebatePercent" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[150px]" label="USDT" tooltip="Monto final de reintegro expresado en USDT." sortKey="rebateUSDT" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[112px]" label="T/C" tooltip="Tipo de cambio promedio usado para convertir el reintegro." sortKey="avgExchangeRate" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[72px]" label="Tx" tooltip="Cantidad de transacciones QR incluidas para el usuario." sortKey="transactionCount" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader className="w-[124px]" label="Estado" tooltip="Estado operativo del pago del reintegro." sortKey="paidOut" align="right" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <TableHead className="h-8 w-10 py-0" aria-label="Ver detalle">
                    <HeaderHint text="Abre el detalle del usuario y sus transacciones.">
                      <span className="sr-only">Ver detalle</span>
                    </HeaderHint>
                  </TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    No hay reintegros que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSorted.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'group cursor-pointer transition-colors hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset',
                      selectedIds.has(row.id) && 'bg-primary/[0.025]',
                    )}
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
                    <TableCell className="px-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar reintegro de ${row.username}`}
                        checked={selectedIds.has(row.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelected(row.id)}
                        className="size-3.5 rounded border-border bg-background accent-primary"
                      />
                    </TableCell>
                    <TableCell className="w-[260px]">
                      <p className="truncate font-medium text-foreground">{row.username}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.userId}</p>
                    </TableCell>
                    <TableCell className="w-[132px] text-right font-mono text-sm tabular-nums">
                      {formatBOB(row.totalSpentBOB)}
                    </TableCell>
                    <TableCell className="w-[124px]">
                      <LevelBadge levelName={row.tierName} variant="soft" />
                    </TableCell>
                    <TableCell className="w-[72px] text-right font-mono text-sm tabular-nums">
                      {formatPercent(row.rebatePercent)}
                    </TableCell>
                    <TableCell className="w-[150px] text-right font-mono text-sm font-semibold tabular-nums text-emerald-400">
                      {formatUSDT(row.rebateUSDT)}
                    </TableCell>
                    <TableCell className="w-[112px] text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {formatRate(row.avgExchangeRate)}
                    </TableCell>
                    <TableCell className="w-[72px] text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {row.transactionCount}
                    </TableCell>
                    <TableCell className="w-[124px] text-right">
                      <PaymentStatusBadge paidOut={row.paidOut} />
                    </TableCell>
                    <TableCell className="w-10 pr-3 text-right">
                      <ChevronRight
                        className="ml-auto size-4 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-focus-visible:text-primary"
                        aria-hidden="true"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-20 border-t border-border bg-card/95 shadow-[0_-10px_24px_-22px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="px-3 py-2">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <FooterMetric label="Total filtrado" value={`${formatUSDT(totals.usdt)} USDT`} />
                    <FooterMetric
                      label="Total seleccionado"
                      value={`${formatUSDT(selectedTotals.usdt)} USDT · ${selectedTotals.users.toLocaleString('es-BO')}`}
                      muted={selectedTotals.users === 0}
                    />
                    <FooterMetric label="Promedio" value={formatBOB(totals.avgTicket)} />
                    <FooterMetric label="Usuarios" value={totals.users.toLocaleString('es-BO')} />
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
            </Table>
          </Card>
        </TooltipProvider>

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
  tooltip,
  sortKey: key,
  active,
  dir,
  align = 'left',
  className,
  onSort,
}: {
  label: string
  tooltip: string
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  align?: 'left' | 'right'
  className?: string
  onSort: (key: SortKey) => void
}): JSX.Element => {
  const isActive = active === key
  const Arrow = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={cn('h-8 py-0', align === 'right' ? 'text-right' : 'text-left', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSort(key)}
            className={cn(
              'inline-flex h-8 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:text-foreground',
              isActive ? 'text-foreground' : 'text-muted-foreground',
              align === 'right' ? 'ml-auto flex-row-reverse' : '',
            )}
          >
            {label}
            <Arrow className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

function HeaderHint({
  text,
  children,
}: {
  text: string
  children: JSX.Element
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{text}</TooltipContent>
    </Tooltip>
  )
}

function FilterBar({
  query,
  tier,
  tiers,
  resultCount,
  totalCount,
  onQueryChange,
  onTierChange,
  onReset,
  onExport,
}: {
  query: string
  tier: string
  tiers: string[]
  resultCount: number
  totalCount: number
  onQueryChange: (value: string) => void
  onTierChange: (value: string) => void
  onReset: () => void
  onExport: () => void
}): JSX.Element {
  const hasQuery = query.trim().length > 0
  const hasTier = tier !== 'ALL'
  const hasActiveFilters = hasQuery || hasTier

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 md:max-w-3xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
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
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Filter />
                Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Nivel</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={tier} onValueChange={onTierChange}>
                {tiers.map((item) => (
                  <DropdownMenuRadioItem key={item} value={item}>
                    {item === 'ALL' ? 'Todos los niveles' : item}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Próximos filtros
              </DropdownMenuLabel>
              <div className="px-2 pb-1 text-xs leading-relaxed text-muted-foreground">
                Estado de pago, rango de monto y conciliación.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={resultCount === 0}
            title={`Exportar ${resultCount} filas a CSV`}
          >
            <Download />
            Exportar
          </Button>
        </div>
      </div>

      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {resultCount.toLocaleString('es-BO')} de {totalCount.toLocaleString('es-BO')}
        </span>
        {hasQuery ? (
          <FilterChip label={`Búsqueda: ${query.trim()}`} onRemove={() => onQueryChange('')} />
        ) : null}
        {hasTier ? (
          <FilterChip label={`Nivel: ${tier}`} onRemove={() => onTierChange('ALL')} />
        ) : null}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpiar filtros
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Sin filtros activos</span>
        )}
      </div>
    </div>
  )
}

function PaymentStatusBadge({ paidOut }: { paidOut: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5',
        paidOut
          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/35 bg-amber-500/10 text-amber-300',
      )}
    >
      {paidOut ? (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      ) : (
        <Clock3 className="size-3" aria-hidden="true" />
      )}
      {paidOut ? 'Pagado' : 'Pendiente'}
    </span>
  )
}

function FooterMetric({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/35 px-2.5 py-1.5">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-xs font-semibold tabular-nums text-foreground',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}): JSX.Element {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/35 px-2.5 py-1 text-xs text-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  )
}

function RebatesTableSkeleton(): JSX.Element {
  const columns = [
    { key: 'select', align: 'left' as const },
    { key: 'user', align: 'left' as const },
    { key: 'bob', align: 'right' as const },
    { key: 'tier', align: 'left' as const },
    { key: 'pct', align: 'right' as const },
    { key: 'usdt', align: 'right' as const },
    { key: 'rate', align: 'right' as const },
    { key: 'tx', align: 'right' as const },
    { key: 'status', align: 'right' as const },
    { key: 'chevron', align: 'right' as const },
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
      <Card className="overflow-hidden">
        <Table
          containerClassName="max-h-[560px] overflow-auto"
          className="min-w-[1080px] table-fixed"
        >
          <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur-xl">
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
                <TableCell className="px-3">
                  <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                </TableCell>
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
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="w-8" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    case 'paidOut':
      return sign * (Number(a.paidOut) - Number(b.paidOut))
    default:
      return 0
  }
}

const getRebateTotals = (rows: MonthlyRebateDTO[]) => {
  const usdt = rows.reduce((sum, r) => sum + Number(r.rebateUSDT), 0)
  const bob = rows.reduce((sum, r) => sum + Number(r.rebateBOB), 0)
  const spent = rows.reduce((sum, r) => sum + Number(r.totalSpentBOB), 0)
  const tx = rows.reduce((sum, r) => sum + r.transactionCount, 0)
  return {
    usdt,
    bob,
    users: rows.length,
    avgTicket: tx === 0 ? 0 : spent / tx,
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
