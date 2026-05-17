import { useEffect, useMemo, useState, type JSX } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import type { AnomalyDTO, ReconciliationStats, UploadSummary } from '@banex/types'
import { api, ApiCallError } from '../../lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
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

const labels: Record<AnomalyDTO['type'], string> = {
  NO_EXTRACT: 'Sin extracto',
  NO_QR: 'Sin QR',
  AMOUNT_MISMATCH: 'Monto distinto',
  INVALID_RATE: 'T/C inválido',
}

const TYPE_TONE: Record<AnomalyDTO['type'], string> = {
  NO_EXTRACT: 'bg-red-500/10 text-red-300 ring-red-500/30',
  NO_QR: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  AMOUNT_MISMATCH: 'bg-primary/10 text-primary ring-primary/30',
  INVALID_RATE: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
}

export function AnomalyPanel(): JSX.Element {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [stats, setStats] = useState<ReconciliationStats | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>([])
  const [type, setType] = useState<'ALL' | AnomalyDTO['type']>('ALL')
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [resolving, setResolving] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [aiText, setAiText] = useState<string>('')
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

  const handleExplain = async (): Promise<void> => {
    if (!upload) return
    setAiStatus('loading')
    setAiText('')
    try {
      const result = await api.explainAnomalies(upload.id)
      setAiText(result.explanation)
      setAiStatus(result.available ? 'done' : 'error')
    } catch (error) {
      const message =
        error instanceof ApiCallError
          ? error.payload.message
          : error instanceof Error
            ? error.message
            : 'No se pudo generar la explicación.'
      setAiText(message)
      setAiStatus('error')
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

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (status === 'empty') {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Procesa un Excel para ver anomalías.
        </CardContent>
      </Card>
    )
  }
  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>No se pudo cargar la conciliación</AlertTitle>
      </Alert>
    )
  }

  const totalAnomalies = stats?.total ?? 0

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Upload conciliado
            </p>
            <h2 className="text-base font-semibold">{upload?.filename}</h2>
            {upload?.period ? (
              <Badge variant="secondary" className="mt-1">
                {upload.period}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-sm text-emerald-300">
              {stats?.reconciliationRate ?? '0.00'}% conciliado
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleExplain()}
              disabled={aiStatus === 'loading' || totalAnomalies === 0}
              className="border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 hover:text-sky-100"
            >
              {aiStatus === 'loading' ? (
                <>
                  <Loader2 className="animate-spin" />
                  Analizando…
                </>
              ) : (
                <>
                  <Sparkles />
                  Explicar con IA
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {aiStatus === 'done' || aiStatus === 'error' ? (
        <Alert
          className={cn(
            'relative',
            aiStatus === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-100 [&>svg]:text-red-300'
              : 'border-sky-500/40 bg-sky-500/10 text-sky-100 [&>svg]:text-sky-300',
          )}
        >
          <Sparkles />
          <AlertTitle>{aiStatus === 'error' ? 'IA no disponible' : 'Explicación generada por IA'}</AlertTitle>
          <AlertDescription className="leading-relaxed">{aiText}</AlertDescription>
          <button
            type="button"
            onClick={() => setAiStatus('idle')}
            className="absolute right-3 top-3 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ) : null}

      {feedback ? (
        <Alert
          className={cn(
            'relative',
            feedback.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground [&>svg]:text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 [&>svg]:text-emerald-300',
          )}
        >
          {feedback.kind === 'error' ? <CircleAlert /> : <CheckCircle2 />}
          <AlertDescription>{feedback.message}</AlertDescription>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="absolute right-3 top-3 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <FilterCard label="Total" value={totalAnomalies} active={type === 'ALL'} onClick={() => setType('ALL')} accent="primary" />
        <FilterCard label="Sin extracto" value={stats?.noExtract ?? 0} active={type === 'NO_EXTRACT'} onClick={() => setType('NO_EXTRACT')} accent="red" />
        <FilterCard label="Sin QR" value={stats?.noQr ?? 0} active={type === 'NO_QR'} onClick={() => setType('NO_QR')} accent="amber" />
        <FilterCard label="Monto distinto" value={stats?.amountMismatch ?? 0} active={type === 'AMOUNT_MISMATCH'} onClick={() => setType('AMOUNT_MISMATCH')} accent="orange" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Transacción</TableHead>
                <TableHead className="text-right">QR BOB</TableHead>
                <TableHead className="text-right">Extracto BOB</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No hay anomalías para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                          TYPE_TONE[row.type],
                        )}
                      >
                        {labels[row.type] ?? row.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.transactionId}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {row.qrAmountBOB ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {row.extractAmountBOB ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-amber-400">
                      {row.deltaBOB ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.resolved ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            Resuelta
                          </span>
                          {row.resolvedNote ? (
                            <p
                              className="line-clamp-1 max-w-[200px] font-mono text-[11px] text-muted-foreground"
                              title={row.resolvedNote}
                            >
                              "{row.resolvedNote}"
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.resolved ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : resolving === row.id ? (
                        <div className="flex flex-col items-end gap-2">
                          <Input
                            autoFocus
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            placeholder="Motivo (opcional)"
                            className="h-8 w-48 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setResolving(null)
                                setResolveNote('')
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-emerald-500 text-white hover:bg-emerald-500/90"
                              onClick={() => void handleResolve(row.id)}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-primary"
                          onClick={() => {
                            setResolving(row.id)
                            setResolveNote('')
                            setFeedback(null)
                          }}
                        >
                          Marcar resuelta
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

type Accent = 'primary' | 'red' | 'amber' | 'orange'

const ACCENT: Record<Accent, { activeBorder: string; activeBg: string; bar: string; text: string }> = {
  primary: {
    activeBorder: 'border-primary/50',
    activeBg: 'bg-primary/10',
    bar: 'bg-primary',
    text: 'text-primary',
  },
  red: {
    activeBorder: 'border-red-500/50',
    activeBg: 'bg-red-500/10',
    bar: 'bg-red-500',
    text: 'text-red-300',
  },
  amber: {
    activeBorder: 'border-amber-500/50',
    activeBg: 'bg-amber-500/10',
    bar: 'bg-amber-500',
    text: 'text-amber-300',
  },
  orange: {
    activeBorder: 'border-orange-500/50',
    activeBg: 'bg-orange-500/10',
    bar: 'bg-orange-500',
    text: 'text-orange-300',
  },
}

function FilterCard({
  label,
  value,
  active,
  onClick,
  accent,
}: {
  label: string
  value: number
  active: boolean
  onClick: () => void
  accent: Accent
}): JSX.Element {
  const styles = ACCENT[accent]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card/40 p-4 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? `${styles.activeBorder} ${styles.activeBg} shadow-md`
          : 'border-border hover:border-border/70 hover:bg-accent/40',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 transition-opacity',
          styles.bar,
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
      />
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-semibold tabular-nums',
          active ? styles.text : 'text-foreground',
        )}
      >
        {value}
      </p>
    </button>
  )
}

function AnomalyPanelSkeleton(): JSX.Element {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="h-4 w-32 rounded skeleton-block" />
          <div className="mt-3 h-5 w-72 max-w-full rounded skeleton-block" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-36 rounded-md skeleton-block" />
          <div className="h-10 w-36 rounded-md skeleton-block" />
          <div className="h-10 w-28 rounded-md skeleton-block" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-line bg-panel p-4">
            <div className="h-3 w-24 rounded skeleton-block" />
            <div className="mt-3 h-7 w-14 rounded skeleton-block" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-app text-left text-xs uppercase tracking-widest text-faint">
            <tr>
              {['Tipo', 'Transaccion', 'QR BOB', 'Extracto BOB', 'Delta', 'Estado', 'Accion'].map((label, index) => {
                const right = (index >= 2 && index <= 4) || index === 6
                return (
                  <th key={label} className={`px-4 py-3 ${right ? 'text-right' : 'text-left'}`}>
                    <div className={`h-3 rounded skeleton-block ${right ? 'ml-auto w-16' : 'w-24'}`} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-dark bg-panel-muted">
            {Array.from({ length: 6 }).map((_, row) => (
              <tr key={row}>
                <td className="px-4 py-3"><div className="h-4 w-24 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="h-4 w-36 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-24 rounded skeleton-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
