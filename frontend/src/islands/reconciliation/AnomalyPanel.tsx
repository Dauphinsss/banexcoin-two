import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Sparkles,
  X,
} from 'lucide-react'
import type { AnomalyDTO, ReconciliationStats, UploadSummary } from '@banex/types'
import { api, ApiCallError } from '../../lib/api'
import { formatPeriodLabel } from '../../lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, resolveUploadId } from '@/lib/utils'
import { EmptyState } from '../shared/EmptyState'

/* ── Estilos para el panel de thinking ─────────────────────────────── */
const THINKING_STYLES = `
@keyframes ai-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes ai-thought-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ai-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes ai-orbit {
  from { transform: rotate(0deg) translateX(10px) rotate(0deg); }
  to   { transform: rotate(360deg) translateX(10px) rotate(-360deg); }
}
@keyframes ai-pulse-ring {
  0%   { transform: scale(1);   opacity: .6; }
  70%  { transform: scale(1.9); opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
.ai-cursor {
  display: inline-block;
  width: 2px; height: 0.9em;
  background: currentColor;
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: ai-blink .9s step-end infinite;
}
.ai-thought {
  animation: ai-thought-in 0.45s cubic-bezier(0.16,1,0.3,1) both;
}
.ai-shimmer-line {
  background: linear-gradient(
    90deg,
    oklch(0.40 0.02 280 / .5) 0%,
    oklch(0.60 0.05 220 / .9) 40%,
    oklch(0.40 0.02 280 / .5) 100%
  );
  background-size: 200% auto;
  animation: ai-shimmer 2s linear infinite;
}
.ai-orbit-dot {
  animation: ai-orbit 2.4s linear infinite;
}
.ai-pulse-ring::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 9999px;
  border: 2px solid oklch(0.65 0.21 220 / .5);
  animation: ai-pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite;
}
`

const THINKING_STEPS = [
  'Leyendo anomalías detectadas…',
  'Clasificando patrones de error…',
  'Correlacionando montos y tipos de cambio…',
  'Evaluando impacto operacional…',
  'Redactando explicación detallada…',
]

function ThinkingPanel(): JSX.Element {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([0])
  const [typedText, setTypedText] = useState('')
  const currentStep = visibleSteps[visibleSteps.length - 1] ?? 0
  const fullText = THINKING_STEPS[currentStep] ?? ''

  /* Efecto de typing para el step actual */
  useEffect(() => {
    setTypedText('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setTypedText(fullText.slice(0, i))
      if (i >= fullText.length) clearInterval(iv)
    }, 28)
    return () => clearInterval(iv)
  }, [fullText])

  /* Avanza al siguiente step cada ~1.8 s */
  useEffect(() => {
    const iv = setInterval(() => {
      setVisibleSteps((prev) => {
        const next = (prev[prev.length - 1] ?? -1) + 1
        if (next >= THINKING_STEPS.length) return prev
        return [...prev, next]
      })
    }, 1800)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <style>{THINKING_STYLES}</style>
      <div
        className="relative overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5 p-5"
        aria-live="polite"
        aria-label="La IA está pensando"
      >
        {/* Fondo de gradiente animado */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 20% 50%, oklch(0.55 0.18 220 / .18), transparent), radial-gradient(ellipse 50% 60% at 80% 40%, oklch(0.50 0.20 280 / .14), transparent)',
          }}
        />

        {/* Encabezado */}
        <div className="relative flex items-center gap-3">
          {/* Ícono con anillos */}
          <div className="relative flex items-center justify-center">
            <div className="ai-pulse-ring relative flex size-9 items-center justify-center rounded-full bg-sky-500/20">
              <Sparkles className="size-4 text-sky-300" />
            </div>
            <span
              className="ai-orbit-dot absolute size-1.5 rounded-full bg-sky-400/80"
              style={{ transformOrigin: '50% 50%' }}
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
              IA pensando
            </p>
            <p className="text-[11px] text-muted-foreground">
              Analizando {THINKING_STEPS.length} dimensiones…
            </p>
          </div>

          {/* Puntos pulsantes tipo ellipsis */}
          <div className="ml-auto flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full bg-sky-400"
                style={{ animation: `ai-blink 1.2s ${i * 0.2}s ease-in-out infinite` }}
              />
            ))}
          </div>
        </div>

        {/* Lista de pasos */}
        <div className="relative mt-4 space-y-2">
          {visibleSteps.map((stepIdx, i) => {
            const isLast = i === visibleSteps.length - 1
            const text = isLast ? typedText : THINKING_STEPS[stepIdx]
            return (
              <div
                key={stepIdx}
                className={cn('ai-thought flex items-start gap-2.5')}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span
                  className={cn(
                    'mt-1 size-1.5 shrink-0 rounded-full',
                    isLast ? 'bg-sky-400' : 'bg-sky-600/60',
                  )}
                />
                <p
                  className={cn(
                    'text-sm leading-relaxed',
                    isLast ? 'text-sky-200' : 'text-muted-foreground',
                  )}
                >
                  {text}
                  {isLast && typedText.length < fullText.length && (
                    <span className="ai-cursor" />
                  )}
                </p>
                {!isLast && (
                  <span className="ml-auto shrink-0 text-[10px] text-emerald-500">✓</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Barras shimmer decorativas */}
        <div className="relative mt-5 space-y-2">
          {[70, 50, 85].map((w, i) => (
            <div
              key={i}
              className="ai-shimmer-line h-1.5 rounded-full"
              style={{ width: `${w}%`, animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

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

interface AnomalyPanelProps {
  uploadId?: string
}

export function AnomalyPanel({ uploadId }: AnomalyPanelProps): JSX.Element {
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
  const pendingAiTextRef = useRef('')
  const flushFrameRef = useRef<number | null>(null)

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

        const [nextStats, rows] = await Promise.all([
          api.reconciliationStats(targetUpload.id),
          api.listAnomalies(targetUpload.id),
        ])
        if (!cancelled) {
          setUpload(targetUpload)
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
  }, [uploadId])

  useEffect(() => {
    return () => {
      cancelFlushFrame()
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

    pendingAiTextRef.current = ''
    cancelFlushFrame()
    setAiStatus('loading')
    setAiText('')

    try {
      await api.explainAnomaliesStream(upload.id, (chunk) => {
        pendingAiTextRef.current += chunk
        scheduleFlush()
      })

      flushPendingText()
      setAiStatus('done')
    } catch (error) {
      pendingAiTextRef.current = ''
      cancelFlushFrame()

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
    return <AnomalyPanelSkeleton />
  }
  if (status === 'empty') {
    return (
      <EmptyState
        title="Aún no hay conciliación que revisar"
        description="Procesa el Excel mensual y aquí verás las anomalías detectadas entre los pagos QR y el extracto bancario, con explicación por IA."
      />
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
              Archivo conciliado
            </p>
            <h2 className="text-base font-semibold">{upload?.filename}</h2>
            {upload?.period ? (
              <Badge variant="secondary" className="mt-1">
                {formatPeriodLabel(upload.period)}
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
              <Sparkles />
              Explicar con IA
            </Button>
            <Button type="button" variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {aiStatus === 'loading' ? <ThinkingPanel /> : null}

      {aiStatus === 'done' || aiStatus === 'error' ? (
        <Alert
          aria-live="polite"
          className={cn(
            'relative',
            aiStatus === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-100 [&>svg]:text-red-300'
              : 'border-sky-500/40 bg-sky-500/10 text-sky-100 [&>svg]:text-sky-300',
          )}
        >
          <Sparkles />
          <AlertTitle>
            {aiStatus === 'error' ? 'IA no disponible' : 'Análisis de anomalías'}
          </AlertTitle>
          <AlertDescription className="whitespace-pre-wrap leading-relaxed">
            {aiText}
          </AlertDescription>
          <button
            type="button"
            onClick={() => {
              pendingAiTextRef.current = ''
              cancelFlushFrame()
              setAiStatus('idle')
              setAiText('')
            }}
            className="absolute right-3 top-3 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ) : null}

      {feedback ? (
        <Alert
          aria-live="polite"
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

      <div className="flex items-center gap-3">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Filtra por tipo de anomalía
        </h3>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Filtros de anomalías">
        <FilterCard label="Total" value={totalAnomalies} active={type === 'ALL'} onClick={() => setType('ALL')} accent="primary" />
        <FilterCard label="Sin extracto" value={stats?.noExtract ?? 0} active={type === 'NO_EXTRACT'} onClick={() => setType('NO_EXTRACT')} accent="red" />
        <FilterCard label="Sin QR" value={stats?.noQr ?? 0} active={type === 'NO_QR'} onClick={() => setType('NO_QR')} accent="amber" />
        <FilterCard label="Monto distinto" value={stats?.amountMismatch ?? 0} active={type === 'AMOUNT_MISMATCH'} onClick={() => setType('AMOUNT_MISMATCH')} accent="orange" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
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
                            name="resolve-note"
                            aria-label="Motivo de resolución (opcional)"
                            autoComplete="off"
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            placeholder="Motivo (opcional)…"
                            className="h-8 w-40 text-xs sm:w-48"
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
    </div >
  )

  function scheduleFlush(): void {
    if (flushFrameRef.current !== null) return

    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null
      flushPendingText()
    })
  }

  function flushPendingText(): void {
    if (pendingAiTextRef.current === '') return

    const nextText = pendingAiTextRef.current
    pendingAiTextRef.current = ''
    setAiText((prev) => prev + nextText)
  }

  function cancelFlushFrame(): void {
    if (flushFrameRef.current === null) return

    window.cancelAnimationFrame(flushFrameRef.current)
    flushFrameRef.current = null
  }
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
      aria-pressed={active}
      title={`Filtrar: ${label}`}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card/40 p-4 text-left transition-[border-color,background-color,box-shadow]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? `${styles.activeBorder} ${styles.activeBg} shadow-md ring-1 ${styles.activeBorder}`
          : 'border-border hover:-translate-y-0.5 hover:border-border/70 hover:bg-accent/40 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 transition-opacity',
          styles.bar,
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {/* Indicador radio: deja claro que es un filtro seleccionable */}
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors',
            active ? `${styles.activeBorder} ${styles.activeBg}` : 'border-border',
          )}
        >
          {active ? <span className={cn('size-1.5 rounded-full', styles.bar)} /> : null}
        </span>
      </div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-line bg-panel p-4">
            <div className="h-3 w-24 rounded skeleton-block" />
            <div className="mt-3 h-7 w-14 rounded skeleton-block" />
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-[860px] divide-y divide-line text-sm">
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
