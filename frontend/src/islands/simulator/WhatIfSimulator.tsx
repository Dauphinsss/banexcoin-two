import { useEffect, useMemo, useState, type JSX } from 'react'
import { calculateRebates, type RebateResult } from '@banex/utils'
import type { CashbackTierDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

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
): { users: number; totalBOB: number; totalUSDT: number; byTier: { name: string; users: number }[] } => ({
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
    setDraftTiers((prev) =>
      prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    )
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

  if (status === 'loading')
    return <p className="text-sm text-slate-400">Cargando simulador...</p>
  if (status === 'empty')
    return <p className="text-sm text-slate-300">Procesa un Excel para simular impacto.</p>
  if (status === 'error')
    return <p className="text-sm text-red-300">No se pudo cargar el simulador.</p>

  const deltaBOB = (draftResult?.totalBOB ?? 0) - (baseResult?.totalBOB ?? 0)
  const deltaUSDT = (draftResult?.totalUSDT ?? 0) - (baseResult?.totalUSDT ?? 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Dataset</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100">
              {upload?.period ?? 'Último upload'}
            </h2>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!dirty}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
          >
            Restablecer
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {draftTiers.map((tier, index) => (
            <div key={tier.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{tier.name}</span>
                <span className="font-mono text-sm text-emerald-200">
                  {tier.rebatePercent.toFixed(2)}%
                </span>
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
                <p className="mt-2 text-xs text-slate-500">Sin tope superior</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={saveAsNew}
          disabled={!dirty}
          className="mt-6 h-10 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Guardar como nueva configuración
        </button>
      </section>

      <section className="space-y-5">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-400">Impacto vs configuración actual</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-400">Distribución por nivel</p>
          <div className="mt-4 space-y-3">
            {(draftResult?.byTier ?? []).map((tier, i) => {
              const totalUsers = draftResult?.users || 1
              const baseUsers = baseResult?.byTier[i]?.users ?? 0
              return (
                <div
                  key={tier.name}
                  className="grid grid-cols-[140px_1fr_120px] items-center gap-3 text-sm"
                >
                  <span className="text-slate-300">{tier.name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(tier.users / totalUsers) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-mono tabular-nums text-slate-300">
                    {tier.users}{' '}
                    <span className="text-slate-500">(antes {baseUsers})</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
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
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{format(value)}</span>
      </div>
      <input
        className="mt-1 w-full accent-blue-500"
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
  const toneClass =
    tone === 'up' ? 'text-amber-300' : tone === 'down' ? 'text-emerald-300' : 'text-slate-500'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-slate-100">{value}</p>
      <p className={`mt-1 font-mono text-xs ${toneClass}`}>{base}</p>
    </div>
  )
}
