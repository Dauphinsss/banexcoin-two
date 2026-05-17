import { useEffect, useMemo, useState, type JSX } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, RotateCcw, Save } from 'lucide-react'
import { calculateRebates, type RebateResult } from '@banex/utils'
import type { CashbackTierDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { formatPeriodLabel } from '../../lib/format'
import { LevelBadge, getLevelColor } from '../../components/LevelBadge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn, resolveUploadId } from '@/lib/utils'
import { EmptyState } from '../shared/EmptyState'

interface MinimalTransaction {
  userId: number
  amountBOB: string
  amountUSDT: string
  exchangeRate: string
}

interface DraftTier {
  id: number
  name: string
  minAmountBOB: number
  maxAmountBOB: number | null
  rebatePercent: number
}

const money = (value: number, fractionDigits = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

const toEngineTiers = (tiers: DraftTier[]) =>
  tiers.map((t) => ({
    id: t.id,
    name: t.name,
    minAmountBOB: String(t.minAmountBOB),
    maxAmountBOB: t.maxAmountBOB === null ? null : String(t.maxAmountBOB),
    rebatePercent: t.rebatePercent.toFixed(2),
  }))

const summarize = (
  rebates: RebateResult[],
  tiers: DraftTier[],
): {
  users: number
  totalBOB: number
  totalUSDT: number
  byTier: { name: string; users: number }[]
} => ({
  users: rebates.filter((r) => r.tierId !== null).length,
  totalBOB: rebates.reduce((sum, row) => sum + Number(row.rebateBOB), 0),
  totalUSDT: rebates.reduce((sum, row) => sum + Number(row.rebateUSDT), 0),
  byTier: tiers.map((tier) => ({
    name: tier.name,
    users: rebates.filter((row) => row.tierId === tier.id).length,
  })),
})

export function WhatIfSimulator(): JSX.Element {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [baseTiers, setBaseTiers] = useState<DraftTier[]>([])
  const [draftTiers, setDraftTiers] = useState<DraftTier[]>([])
  const [transactions, setTransactions] = useState<MinimalTransaction[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const resolvedId = resolveUploadId()
        const latest = resolvedId
          ? await api.getUpload(resolvedId)
          : (await api.listUploads({ status: 'DONE' }))[0] ?? null
        if (!latest) {
          if (!cancelled) setStatus('empty')
          return
        }
        if (latest.status !== 'DONE') {
          if (!cancelled) setStatus('empty')
          return
        }

        const [nextTiers, nextTransactions] = await Promise.all([
          api.listTiers(latest.period ?? undefined),
          api.listMinimalTransactions(latest.id),
        ])

        const mapped: DraftTier[] = nextTiers.map((t: CashbackTierDTO) => ({
          id: t.level,
          name: t.name,
          minAmountBOB: Number(t.minAmountBOB),
          maxAmountBOB: t.maxAmountBOB === null ? null : Number(t.maxAmountBOB),
          rebatePercent: Number(t.rebatePercent),
        }))

        if (!cancelled) {
          setUpload(latest)
          setBaseTiers(mapped)
          setDraftTiers(mapped.map((t) => ({ ...t })))
          setTransactions(nextTransactions)
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

  const baseResult = useMemo(() => {
    if (transactions.length === 0) return null
    return summarize(
      calculateRebates({ transactions, tiers: toEngineTiers(baseTiers) }),
      baseTiers,
    )
  }, [transactions, baseTiers])

  const draftResult = useMemo(() => {
    if (transactions.length === 0) return null
    return summarize(
      calculateRebates({ transactions, tiers: toEngineTiers(draftTiers) }),
      draftTiers,
    )
  }, [transactions, draftTiers])

  const dirty = useMemo(
    () => JSON.stringify(baseTiers) !== JSON.stringify(draftTiers),
    [baseTiers, draftTiers],
  )

  const updateTier = (index: number, patch: Partial<DraftTier>): void => {
    setDraftTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)))
  }

  const reset = (): void => setDraftTiers(baseTiers.map((t) => ({ ...t })))

  const saveAsNew = (): void => {
    sessionStorage.setItem(
      'banex:simulator-draft',
      JSON.stringify(
        draftTiers.map((t) => ({
          level: t.id,
          name: t.name,
          minAmountBOB: String(t.minAmountBOB),
          maxAmountBOB: t.maxAmountBOB === null ? null : String(t.maxAmountBOB),
          rebatePercent: t.rebatePercent.toFixed(2),
        })),
      ),
    )
    window.location.href = '/tiers?from=simulator'
  }

  if (status === 'loading') {
    return <SimulatorSkeleton />
  }
  if (status === 'empty') {
    return (
      <EmptyState
        title="Aún no hay datos para simular"
        description="Procesa el Excel mensual y aquí podrás ajustar los niveles de cashback en vivo para ver cómo cambia el costo total antes de publicar."
      />
    )
  }
  if (status === 'error') {
    return (
      <div aria-live="polite">
        <Alert variant="destructive">
          <AlertDescription>No se pudo cargar el simulador.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const deltaBOB = (draftResult?.totalBOB ?? 0) - (baseResult?.totalBOB ?? 0)
  const deltaUSDT = (draftResult?.totalUSDT ?? 0) - (baseResult?.totalUSDT ?? 0)

  const anyChanges = draftTiers.some((t, i) => {
    const b = baseTiers[i]
    return (
      t.rebatePercent !== b.rebatePercent ||
      t.minAmountBOB !== b.minAmountBOB ||
      t.maxAmountBOB !== b.maxAmountBOB
    )
  })

  return (
    <div className="reveal-stack min-w-0 space-y-5">
      {/* ─── Command bar: contexto + acciones ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 shadow-xl shadow-black/10">
        <div className="pointer-events-none absolute -top-24 right-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl ambient-glow" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <span className="font-mono text-lg font-bold text-primary">Σ</span>
              <span className="absolute -right-1 -top-1 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Impacto simulado
              </p>
              <h2 className="mt-0.5 text-balance text-xl font-semibold leading-tight md:text-2xl">
                {formatPeriodLabel(upload?.period)}
              </h2>
              {upload?.filename ? (
                <p className="mt-1 line-clamp-1 font-mono text-[11px] text-muted-foreground">
                  {upload.filename}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                Sin guardar
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                Sincronizado
              </span>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!dirty} className="text-muted-foreground">
              <RotateCcw />
              Restablecer
            </Button>
            <Button type="button" size="sm" onClick={saveAsNew} disabled={!dirty}>
              <Save />
              Guardar configuración
              <ArrowRight />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Hero metric strip: el corazón del simulador ──────────────── */}
      <div className="grid gap-3 md:grid-cols-3">
        <HeroMetric
          eyebrow="Usuarios con reintegro"
          value={String(draftResult?.users ?? 0)}
          baseValue={String(baseResult?.users ?? 0)}
          delta={(draftResult?.users ?? 0) - (baseResult?.users ?? 0)}
          deltaFormatter={(d) => `${d >= 0 ? '+' : ''}${d}`}
          neutral
        />
        <HeroMetric
          eyebrow="Costo · BOB"
          value={money(draftResult?.totalBOB ?? 0)}
          prefix="Bs"
          baseValue={`Bs ${money(baseResult?.totalBOB ?? 0)}`}
          delta={deltaBOB}
          deltaFormatter={(d) => `${d >= 0 ? '+' : ''}${money(d)}`}
        />
        <HeroMetric
          eyebrow="Costo · USDT"
          value={money(draftResult?.totalUSDT ?? 0, 4)}
          prefix="₮"
          baseValue={`₮ ${money(baseResult?.totalUSDT ?? 0, 4)}`}
          delta={deltaUSDT}
          deltaFormatter={(d) => `${d >= 0 ? '+' : ''}${money(d, 4)}`}
        />
      </div>

      {/* ─── Workbench: controles + análisis unificado ────────────────── */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">

        {/* Panel izquierdo: solo controles, sticky, compacto */}
        <div className="lg:sticky lg:top-[calc(64px+1.5rem)] lg:self-start">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card/70">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden="true" />
            <div className="relative space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Parámetros
                </p>
                <span className="font-mono text-[10px] text-muted-foreground">{draftTiers.length} tiers</span>
              </div>
              <div className="h-px w-full origin-left bg-gradient-to-r from-primary/40 via-border to-transparent section-rule" />

              <div className="space-y-2.5">
                {draftTiers.map((tier, index) => {
                  const base = baseTiers[index]
                  const tierChanged =
                    tier.rebatePercent !== base.rebatePercent ||
                    tier.minAmountBOB !== base.minAmountBOB ||
                    tier.maxAmountBOB !== base.maxAmountBOB
                  return (
                    <div
                      key={tier.id}
                      className={cn(
                        'relative space-y-2.5 overflow-hidden rounded-lg border bg-muted/15 p-3 transition-colors',
                        tierChanged ? 'border-primary/40 bg-primary/[0.04]' : 'border-border',
                      )}
                    >
                      {tierChanged ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                      ) : null}
                      <div className="flex items-center justify-between pl-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold tracking-tight">{tier.name}</span>
                          {tierChanged ? (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                              edit
                            </span>
                          ) : null}
                        </div>
                        <span className="font-mono text-xs font-bold tabular-nums text-emerald-300">
                          {tier.rebatePercent.toFixed(2)}%
                        </span>
                      </div>
                      <Slider
                        label="Reintegro"
                        min={0}
                        max={10}
                        step={0.05}
                        value={tier.rebatePercent}
                        baseValue={base.rebatePercent}
                        onChange={(v) => updateTier(index, { rebatePercent: v })}
                        format={(v) => `${v.toFixed(2)}%`}
                      />
                      <Slider
                        label="Desde"
                        min={0}
                        max={10000}
                        step={50}
                        value={tier.minAmountBOB}
                        baseValue={base.minAmountBOB}
                        onChange={(v) => updateTier(index, { minAmountBOB: v })}
                        format={(v) => `Bs ${money(v, 0)}`}
                      />
                      {tier.maxAmountBOB !== null && base.maxAmountBOB !== null ? (
                        <Slider
                          label="Hasta"
                          min={0}
                          max={20000}
                          step={50}
                          value={tier.maxAmountBOB}
                          baseValue={base.maxAmountBOB}
                          onChange={(v) => updateTier(index, { maxAmountBOB: v })}
                          format={(v) => `Bs ${money(v, 0)}`}
                        />
                      ) : (
                        <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground">
                          <span className="uppercase tracking-wider">Hasta</span>
                          <span className="font-mono">∞ sin tope</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: análisis unificado por tier */}
        <section className="min-w-0">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card/70">
            <div className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-500/[0.08] blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-24 left-1/3 h-56 w-56 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden="true" />

            <div className="relative space-y-5 p-5 md:p-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Análisis por nivel
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">Distribución de usuarios y diferencia de parámetros</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {anyChanges ? 'modificado' : 'sin cambios'}
                </span>
              </div>
              <div className="h-px w-full origin-left bg-gradient-to-r from-primary/40 via-border to-transparent section-rule" />

              <div className="space-y-3">
                {draftTiers.map((tier, i) => {
                  const base = baseTiers[i]
                  const tierResult = draftResult?.byTier[i]
                  const baseTierResult = baseResult?.byTier[i]
                  const users = tierResult?.users ?? 0
                  const baseUsers = baseTierResult?.users ?? 0
                  const userDelta = users - baseUsers
                  const totalUsers = draftResult?.users || 1
                  const pct = totalUsers > 0 ? (users / totalUsers) * 100 : 0

                  const rebateChanged = tier.rebatePercent !== base.rebatePercent
                  const minChanged = tier.minAmountBOB !== base.minAmountBOB
                  const maxChanged = tier.maxAmountBOB !== base.maxAmountBOB
                  const tierChanged = rebateChanged || minChanged || maxChanged

                  return (
                    <div
                      key={tier.id}
                      className={cn(
                        'relative overflow-hidden rounded-lg border bg-muted/15 p-4 transition-colors',
                        tierChanged ? 'border-primary/30' : 'border-border',
                      )}
                    >
                      {tierChanged ? (
                        <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                      ) : null}

                      {/* Header: tier name + user count + delta */}
                      <div className="mb-3 flex items-baseline justify-between gap-3 pl-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <LevelBadge levelName={tier.name} variant="soft" />
                          {tierChanged ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                              modificado
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-2xl font-semibold tabular-nums leading-none">
                            {users}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            usuarios
                          </span>
                          <span
                            className={cn(
                              'font-mono text-xs tabular-nums',
                              userDelta > 0 && 'text-emerald-400',
                              userDelta < 0 && 'text-amber-400',
                              userDelta === 0 && 'text-muted-foreground',
                            )}
                          >
                            {userDelta >= 0 ? '+' : ''}{userDelta}
                          </span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="mb-4 flex items-center gap-3 pl-1">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: getLevelColor(tier.name) }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-foreground/80">
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      {/* Param diff cells */}
                      <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-3 pl-1">
                        <CompareCell
                          label="Reintegro"
                          before={`${base.rebatePercent.toFixed(2)}%`}
                          after={`${tier.rebatePercent.toFixed(2)}%`}
                          changed={rebateChanged}
                        />
                        <CompareCell
                          label="Desde"
                          before={`Bs ${money(base.minAmountBOB, 0)}`}
                          after={`Bs ${money(tier.minAmountBOB, 0)}`}
                          changed={minChanged}
                        />
                        <CompareCell
                          label="Hasta"
                          before={base.maxAmountBOB === null ? '∞' : `Bs ${money(base.maxAmountBOB, 0)}`}
                          after={tier.maxAmountBOB === null ? '∞' : `Bs ${money(tier.maxAmountBOB, 0)}`}
                          changed={maxChanged}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function CompareCell({
  label,
  before,
  after,
  changed,
}: {
  label: string
  before: string
  after: string
  changed: boolean
}): JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {changed ? (
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] text-muted-foreground line-through tabular-nums">{before}</p>
          <p className="font-mono text-[11px] font-semibold text-primary tabular-nums">{after}</p>
        </div>
      ) : (
        <p className="font-mono text-[11px] tabular-nums text-foreground">{after}</p>
      )}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  baseValue,
  onChange,
  format,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  baseValue?: number
  onChange: (value: number) => void
  format: (value: number) => string
}): JSX.Element {
  const changed = baseValue !== undefined && baseValue !== value
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          {changed ? (
            <span className="font-mono text-[10px] text-muted-foreground line-through">
              {format(baseValue as number)}
            </span>
          ) : null}
          <span className={cn(
            'font-mono text-xs font-semibold tabular-nums',
            changed ? 'text-primary' : 'text-foreground',
          )}>
            {format(value)}
          </span>
        </div>
      </div>
      <input
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        type="range"
        aria-label={label}
        aria-valuetext={format(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function HeroMetric({
  eyebrow,
  value,
  prefix,
  baseValue,
  delta,
  deltaFormatter,
  neutral = false,
}: {
  eyebrow: string
  value: string
  prefix?: string
  baseValue: string
  delta: number
  deltaFormatter: (d: number) => string
  neutral?: boolean
}): JSX.Element {
  const isUp = delta > 0
  const isDown = delta < 0
  const Arrow = isUp ? ArrowUp : isDown ? ArrowDown : null
  const tone = delta === 0
    ? 'text-muted-foreground'
    : neutral
      ? (isUp ? 'text-emerald-400' : 'text-amber-400')
      : (isUp ? 'text-amber-400' : 'text-emerald-400')
  const accentBar = delta === 0
    ? 'from-muted via-muted to-transparent'
    : neutral
      ? (isUp ? 'from-emerald-500/60 via-emerald-400/30 to-transparent' : 'from-amber-500/60 via-amber-400/30 to-transparent')
      : (isUp ? 'from-amber-500/60 via-amber-400/30 to-transparent' : 'from-emerald-500/60 via-emerald-400/30 to-transparent')
  const chipBg = delta === 0
    ? 'border-border bg-muted/30'
    : neutral
      ? (isUp ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10')
      : (isUp ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10')

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card/70 transition-colors hover:border-white/10">
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r', accentBar)} aria-hidden="true" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/[0.04] blur-2xl transition-opacity group-hover:opacity-100" aria-hidden="true" />

      <div className="relative flex items-center justify-between gap-3 p-5">
        {/* Left: eyebrow + value */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          <div className="mt-2.5 flex items-baseline gap-1">
            {prefix ? (
              <span className="font-mono text-xs font-medium text-muted-foreground">{prefix}</span>
            ) : null}
            <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums leading-none md:text-[2.25rem]">
              {value}
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
            base: <span className="text-foreground/70">{baseValue}</span>
          </p>
        </div>

        {/* Right: delta chip */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums',
            chipBg,
            tone,
          )}>
            {Arrow ? <Arrow className="size-3" strokeWidth={2.5} /> : <span className="size-1 rounded-full bg-current" aria-hidden="true" />}
            {deltaFormatter(delta)}
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {delta === 0 ? 'sin cambio' : isUp ? (neutral ? 'sube' : 'aumenta') : (neutral ? 'baja' : 'ahorra')}
          </span>
        </div>
      </div>
    </div>
  )
}

function SimulatorSkeleton(): JSX.Element {
  return (
    <div className="min-w-0 space-y-5" aria-hidden="true">
      {/* Command bar skeleton */}
      <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl skeleton-block" />
            <div className="space-y-1.5">
              <div className="h-3 w-32 rounded skeleton-block" />
              <div className="h-6 w-44 rounded skeleton-block" />
              <div className="h-3 w-52 rounded skeleton-block" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-28 rounded-full skeleton-block" />
            <div className="h-8 w-28 rounded-md skeleton-block" />
            <div className="h-8 w-44 rounded-md skeleton-block" />
          </div>
        </div>
      </div>

      {/* Hero metrics skeleton */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-line bg-panel p-5">
            <div className="h-3 w-28 rounded skeleton-block" />
            <div className="mt-3 h-9 w-36 rounded skeleton-block" />
            <div className="mt-3 h-3 w-24 rounded skeleton-block" />
          </div>
        ))}
      </div>

      {/* Workbench skeleton */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[calc(64px+1.5rem)] lg:self-start">
          <section className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between">
              <div className="h-3 w-20 rounded skeleton-block" />
              <div className="h-3 w-10 rounded skeleton-block" />
            </div>
            <div className="mt-3 h-px w-full rounded skeleton-block" />
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 3 }).map((_, tier) => (
                <div key={tier} className="rounded-lg border border-line bg-panel-inset p-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-20 rounded skeleton-block" />
                    <div className="h-3.5 w-12 rounded skeleton-block" />
                  </div>
                  {[0, 1, 2].map((slider) => (
                    <div key={slider} className="mt-2.5">
                      <div className="flex items-center justify-between">
                        <div className="h-2.5 w-16 rounded skeleton-block" />
                        <div className="h-2.5 w-14 rounded skeleton-block" />
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full skeleton-block" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="min-w-0">
          <div className="rounded-xl border border-line bg-panel p-5 md:p-6">
            <div className="flex items-baseline justify-between">
              <div className="space-y-1.5">
                <div className="h-3 w-28 rounded skeleton-block" />
                <div className="h-4 w-60 rounded skeleton-block" />
              </div>
              <div className="h-3 w-16 rounded skeleton-block" />
            </div>
            <div className="mt-4 h-px w-full rounded skeleton-block" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="rounded-lg border border-line bg-panel-inset p-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-24 rounded skeleton-block" />
                    <div className="h-6 w-28 rounded skeleton-block" />
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full skeleton-block" />
                  <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
                    {[0, 1, 2].map((col) => (
                      <div key={col}>
                        <div className="h-2.5 w-12 rounded skeleton-block" />
                        <div className="mt-1.5 h-3 w-16 rounded skeleton-block" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
