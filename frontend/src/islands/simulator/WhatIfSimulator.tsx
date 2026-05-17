import { useEffect, useMemo, useState, type JSX } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, RotateCcw, Save } from 'lucide-react'
import { calculateRebates, type RebateResult } from '@banex/utils'
import type { CashbackTierDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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
        const uploads = await api.listUploads()
        const latest = uploads.find((item) => item.status === 'DONE') ?? null
        if (!latest) {
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
    return (
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Skeleton className="h-[480px] w-full" />
        <div className="space-y-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }
  if (status === 'empty') {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Procesa un Excel para simular impacto.
        </CardContent>
      </Card>
    )
  }
  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription>No se pudo cargar el simulador.</AlertDescription>
      </Alert>
    )
  }

  const deltaBOB = (draftResult?.totalBOB ?? 0) - (baseResult?.totalBOB ?? 0)
  const deltaUSDT = (draftResult?.totalUSDT ?? 0) - (baseResult?.totalUSDT ?? 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Dataset
              </p>
              <h2 className="text-base font-semibold">{upload?.period ?? 'Último upload'}</h2>
              {upload?.filename ? (
                <p className="line-clamp-1 font-mono text-xs text-muted-foreground">
                  {upload.filename}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!dirty}
              className="text-muted-foreground"
            >
              <RotateCcw />
              Restablecer
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            {draftTiers.map((tier, index) => (
              <div
                key={tier.id}
                className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{tier.name}</span>
                  <Badge
                    variant="secondary"
                    className="border-emerald-500/30 bg-emerald-500/10 font-mono text-emerald-300"
                  >
                    {tier.rebatePercent.toFixed(2)}%
                  </Badge>
                </div>
                <Slider
                  label="Reintegro %"
                  min={0}
                  max={10}
                  step={0.05}
                  value={tier.rebatePercent}
                  onChange={(v) => updateTier(index, { rebatePercent: v })}
                  format={(v) => `${v.toFixed(2)}%`}
                />
                <Slider
                  label="Desde BOB"
                  min={0}
                  max={10000}
                  step={50}
                  value={tier.minAmountBOB}
                  onChange={(v) => updateTier(index, { minAmountBOB: v })}
                  format={(v) => money(v)}
                />
                {tier.maxAmountBOB !== null ? (
                  <Slider
                    label="Hasta BOB"
                    min={0}
                    max={20000}
                    step={50}
                    value={tier.maxAmountBOB}
                    onChange={(v) => updateTier(index, { maxAmountBOB: v })}
                    format={(v) => money(v)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin tope superior</p>
                )}
              </div>
            ))}
          </div>

          <Button type="button" onClick={saveAsNew} disabled={!dirty} className="w-full">
            <Save />
            Guardar como nueva configuración
            <ArrowRight />
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-5">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Impacto vs configuración actual
              </p>
              {dirty ? (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Sin guardar
                </Badge>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric
                label="Usuarios con reintegro"
                value={String(draftResult?.users ?? 0)}
                base={`actual: ${baseResult?.users ?? 0}`}
              />
              <Metric
                label="Costo BOB"
                value={money(draftResult?.totalBOB ?? 0)}
                base={`Δ ${deltaBOB >= 0 ? '+' : ''}${money(deltaBOB)}`}
                tone={deltaBOB > 0 ? 'up' : deltaBOB < 0 ? 'down' : 'flat'}
              />
              <Metric
                label="Costo USDT"
                value={money(draftResult?.totalUSDT ?? 0, 8)}
                base={`Δ ${deltaUSDT >= 0 ? '+' : ''}${money(deltaUSDT, 8)}`}
                tone={deltaUSDT > 0 ? 'up' : deltaUSDT < 0 ? 'down' : 'flat'}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Distribución por nivel
            </p>
            <div className="space-y-3">
              {(draftResult?.byTier ?? []).map((tier, i) => {
                const totalUsers = draftResult?.users || 1
                const baseUsers = baseResult?.byTier[i]?.users ?? 0
                const delta = tier.users - baseUsers
                return (
                  <div
                    key={tier.name}
                    className="grid grid-cols-[140px_1fr_140px] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{tier.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${(tier.users / totalUsers) * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-xs tabular-nums">
                      <span className="text-foreground">{tier.users}</span>{' '}
                      <span
                        className={cn(
                          'text-[11px]',
                          delta > 0 && 'text-emerald-400',
                          delta < 0 && 'text-amber-400',
                          delta === 0 && 'text-muted-foreground',
                        )}
                      >
                        ({delta >= 0 ? '+' : ''}
                        {delta})
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  format: (value: number) => string
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{format(value)}</span>
      </div>
      <input
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  base,
  tone = 'flat',
}: {
  label: string
  value: string
  base: string
  tone?: 'up' | 'down' | 'flat'
}): JSX.Element {
  const Arrow = tone === 'up' ? ArrowUp : tone === 'down' ? ArrowDown : null
  const toneClass =
    tone === 'up'
      ? 'text-amber-400'
      : tone === 'down'
        ? 'text-emerald-400'
        : 'text-muted-foreground'
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className={cn('mt-1 inline-flex items-center gap-1 font-mono text-xs', toneClass)}>
        {Arrow ? <Arrow className="size-3" /> : null}
        {base}
      </p>
    </div>
  )
}

function SimulatorSkeleton(): JSX.Element {
  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]" aria-hidden="true">
      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-20 rounded skeleton-block" />
            <div className="mt-3 h-5 w-32 rounded skeleton-block" />
          </div>
          <div className="h-4 w-20 rounded skeleton-block" />
        </div>

        <div className="mt-6 space-y-6">
          {Array.from({ length: 3 }).map((_, tier) => (
            <div key={tier} className="rounded-md border border-line bg-panel-inset p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded skeleton-block" />
                <div className="h-4 w-14 rounded skeleton-block" />
              </div>
              {[0, 1, 2].map((slider) => (
                <div key={slider} className="mt-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 rounded skeleton-block" />
                    <div className="h-3 w-16 rounded skeleton-block" />
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full skeleton-block" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 h-10 w-full rounded-md skeleton-block" />
      </section>

      <section className="space-y-5">
        <div className="rounded-lg border border-line bg-panel p-5">
          <div className="h-4 w-48 rounded skeleton-block" />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-lg border border-line bg-panel-inset-strong p-4">
                <div className="h-3 w-28 rounded skeleton-block" />
                <div className="mt-3 h-6 w-20 rounded skeleton-block" />
                <div className="mt-2 h-3 w-16 rounded skeleton-block" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5">
          <div className="h-4 w-40 rounded skeleton-block" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={row} className="grid grid-cols-[140px_1fr_120px] items-center gap-3">
                <div className="h-4 w-24 rounded skeleton-block" />
                <div className="h-2 rounded-full skeleton-block" />
                <div className="ml-auto h-4 w-20 rounded skeleton-block" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
