import { useEffect, useState } from 'react'
import type { CashbackTierDTO } from '@banex/types'
import { api } from '../../lib/api'

export function TiersList() {
  const [tiers, setTiers] = useState<CashbackTierDTO[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    api.listTiers()
      .then((rows) => {
        if (!cancelled) {
          setTiers(rows)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') return <p className="text-sm text-muted">Cargando niveles...</p>
  if (status === 'error') return <p className="text-sm text-danger">No se pudieron cargar los niveles.</p>

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-app text-left text-xs uppercase tracking-widest text-faint">
          <tr>
            <th className="px-4 py-3">Nivel</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3 text-right">Desde BOB</th>
            <th className="px-4 py-3 text-right">Hasta BOB</th>
            <th className="px-4 py-3 text-right">Reintegro</th>
            <th className="px-4 py-3">Vigencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-dark bg-panel-muted">
          {tiers.map((tier) => (
            <tr key={tier.id}>
              <td className="px-4 py-3 font-mono text-muted">{tier.level}</td>
              <td className="px-4 py-3 font-medium text-main">{tier.name}</td>
              <td className="px-4 py-3 text-right font-mono text-muted">{tier.minAmountBOB}</td>
              <td className="px-4 py-3 text-right font-mono text-muted">{tier.maxAmountBOB ?? 'Sin tope'}</td>
              <td className="px-4 py-3 text-right font-mono text-success">{tier.rebatePercent}%</td>
              <td className="px-4 py-3 text-muted">
                {tier.validFromPeriod} - {tier.validToPeriod ?? 'actual'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
