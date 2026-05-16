import { useEffect, useMemo, useState } from 'react'
import { calculateRebates } from '@banex/utils/tier-engine'
import type { CashbackTierDTO, UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

interface MinimalTransaction {
  userId: number
  amountBOB: string
  amountUSDT: string
  exchangeRate: string
}

const money = (value: number, fractionDigits = 2) =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

export function WhatIfSimulator() {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [tiers, setTiers] = useState<CashbackTierDTO[]>([])
  const [transactions, setTransactions] = useState<MinimalTransaction[]>([])
  const [multiplier, setMultiplier] = useState(100)
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

        const [nextTiers, nextTransactions] = await Promise.all([
          api.listTiers(latest.period ?? undefined),
          api.listMinimalTransactions(latest.id),
        ])

        if (!cancelled) {
          setUpload(latest)
          setTiers(nextTiers)
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

  const result = useMemo(() => {
    const adjustedTiers = tiers.map((tier) => ({
      id: tier.level,
      name: tier.name,
      minAmountBOB: tier.minAmountBOB,
      maxAmountBOB: tier.maxAmountBOB,
      rebatePercent: (Number(tier.rebatePercent) * multiplier / 100).toFixed(2),
    }))

    const rebates = calculateRebates({
      transactions,
      tiers: adjustedTiers,
    })

    return {
      users: rebates.length,
      totalBOB: rebates.reduce((sum, row) => sum + Number(row.rebateBOB), 0),
      totalUSDT: rebates.reduce((sum, row) => sum + Number(row.rebateUSDT), 0),
      byTier: adjustedTiers.map((tier) => ({
        name: tier.name,
        percent: tier.rebatePercent,
        users: rebates.filter((row) => row.tierId === tier.id).length,
      })),
    }
  }, [multiplier, tiers, transactions])

  if (status === 'loading') return <p className="text-sm text-slate-400">Cargando simulador...</p>
  if (status === 'empty') return <p className="text-sm text-slate-300">Procesa un Excel para simular impacto.</p>
  if (status === 'error') return <p className="text-sm text-red-300">No se pudo cargar el simulador.</p>

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-sm text-slate-400">Dataset</p>
        <h2 className="mt-1 text-base font-semibold text-slate-100">{upload?.period ?? 'Último upload'}</h2>

        <label className="mt-6 block text-sm font-medium text-slate-300" htmlFor="rebate-multiplier">
          Factor de reintegro
        </label>
        <input
          id="rebate-multiplier"
          className="mt-4 w-full accent-blue-500"
          min={50}
          max={200}
          step={5}
          type="range"
          value={multiplier}
          onChange={(event) => setMultiplier(Number(event.target.value))}
        />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">50%</span>
          <span className="font-mono text-slate-100">{multiplier}%</span>
          <span className="text-slate-500">200%</span>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Usuarios" value={String(result.users)} />
          <Metric label="Costo BOB" value={money(result.totalBOB)} />
          <Metric label="Costo USDT" value={money(result.totalUSDT, 8)} />
        </div>

        <div className="mt-6 space-y-3">
          {result.byTier.map((tier) => (
            <div key={tier.name} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 text-sm">
              <span className="text-slate-300">{tier.name}</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${result.users === 0 ? 0 : (tier.users / result.users) * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-slate-300">{tier.percent}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}
