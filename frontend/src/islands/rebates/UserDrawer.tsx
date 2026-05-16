import { useEffect, useState, type JSX } from 'react'
import type { MonthlyRebateDTO, QRTransactionDTO } from '@banex/types'
import { api, ApiCallError } from '../../lib/api'
import {
  formatBOB,
  formatDateTime,
  formatPercent,
  formatRate,
  formatUSDT,
  formatUSDTCompact,
} from '../../lib/format'

interface UserDrawerProps {
  uploadId: string
  rebate: MonthlyRebateDTO | null
  onClose: () => void
}

export const UserDrawer = ({ uploadId, rebate, onClose }: UserDrawerProps): JSX.Element | null => {
  const [transactions, setTransactions] = useState<QRTransactionDTO[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<QRTransactionDTO | null>(null)

  // Cargar transacciones cuando se selecciona un rebate
  useEffect(() => {
    if (!rebate) {
      setStatus('idle')
      setTransactions([])
      setSelectedTx(null)
      return
    }

    let cancelled = false
    setStatus('loading')
    setSelectedTx(null)

    const load = async (): Promise<void> => {
      try {
        const rows = await api.listUserTransactions(uploadId, rebate.userId)
        if (cancelled) return
        setTransactions(rows)
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof ApiCallError
            ? error.payload.message
            : error instanceof Error
              ? error.message
              : 'Error al cargar transacciones.'
        setErrorMessage(message)
        setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [rebate, uploadId])

  // Cerrar con ESC
  useEffect(() => {
    if (!rebate) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (selectedTx) setSelectedTx(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rebate, selectedTx, onClose])

  if (!rebate) return null

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className="h-full w-full max-w-2xl bg-slate-950 border-l border-slate-800 shadow-2xl overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slide-in 250ms ease-in-out' }}
      >
        <header className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-500">Detalle de usuario</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100 truncate">{rebate.username}</h2>
            <p className="text-xs text-slate-500 font-mono">Cuenta {rebate.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-2"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <section className="px-6 py-5 space-y-4 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryRow label="Total gastado" value={formatBOB(rebate.totalSpentBOB)} />
            <SummaryRow
              label="Nivel"
              value={
                <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs text-blue-200">
                  {rebate.tierName ?? 'Sin nivel'}
                </span>
              }
            />
            <SummaryRow label="% Cashback" value={formatPercent(rebate.rebatePercent)} />
            <SummaryRow
              label="T/C promedio"
              value={
                <span className="font-mono tabular-nums text-slate-200">
                  {formatRate(rebate.avgExchangeRate)}
                </span>
              }
            />
            <SummaryRow
              label="Reintegro USDT"
              value={
                <span className="font-mono tabular-nums text-emerald-200">
                  {formatUSDT(rebate.rebateUSDT)}
                </span>
              }
              highlight
            />
            <SummaryRow
              label="Reintegro BOB"
              value={
                <span className="font-mono tabular-nums text-slate-200">
                  {formatBOB(rebate.rebateBOB)}
                </span>
              }
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{rebate.transactionCount} transacciones · período {rebate.period}</span>
            <span className={rebate.paidOut ? 'text-emerald-300' : ''}>
              {rebate.paidOut
                ? `✓ Pagado el ${formatDateTime(rebate.paidOutAt)}`
                : 'Pendiente de pago'}
            </span>
          </div>
        </section>

        <section className="px-6 py-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Transacciones del período</h3>
          {status === 'loading' ? (
            <p className="text-sm text-slate-400">Cargando transacciones...</p>
          ) : status === 'error' ? (
            <p className="text-sm text-red-300">{errorMessage}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-slate-400">Sin transacciones para mostrar.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-right">BOB</th>
                    <th className="px-3 py-2 text-right">USDT</th>
                    <th className="px-3 py-2 text-right">T/C</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-900/60 cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="px-3 py-2 text-slate-300 font-mono">
                        {formatDateTime(tx.transactedAt).slice(0, 16)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">
                        {formatBOB(tx.amountBOB)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-300">
                        {formatUSDTCompact(tx.amountUSDT)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-400">
                        {formatRate(tx.exchangeRate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {tx.reconciledWithExtract ? (
                          <span className="text-emerald-300" title="Conciliada con extracto">✓</span>
                        ) : (
                          <span className="text-amber-300" title="Sin conciliar">⚠</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </aside>

      {selectedTx ? (
        <TransactionModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      ) : null}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

export default UserDrawer

const SummaryRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: JSX.Element | string
  highlight?: boolean
}): JSX.Element => (
  <div
    className={`rounded-md border px-3 py-2 ${
      highlight
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-slate-800 bg-slate-900/40'
    }`}
  >
    <p className="text-xs text-slate-500">{label}</p>
    <div className="mt-1 text-slate-100">{value}</div>
  </div>
)

const TransactionModal = ({
  transaction,
  onClose,
}: {
  transaction: QRTransactionDTO
  onClose: () => void
}): JSX.Element => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-950 p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-slate-100">Transacción QR</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xl leading-none"
        >
          ×
        </button>
      </header>
      <dl className="grid grid-cols-1 gap-2 text-sm">
        <ModalField label="ID transacción" value={transaction.transactionId} mono />
        <ModalField label="Fecha" value={formatDateTime(transaction.transactedAt)} />
        <ModalField label="Estado" value={transaction.status} />
        <ModalField label="Monto BOB" value={formatBOB(transaction.amountBOB)} mono />
        <ModalField label="Monto USDT" value={formatUSDT(transaction.amountUSDT)} mono />
        <ModalField label="Tipo de cambio" value={formatRate(transaction.exchangeRate)} mono />
        <ModalField label="Comisión BOB" value={formatBOB(transaction.commission)} mono />
        <ModalField
          label="Conciliada"
          value={
            transaction.reconciledWithExtract
              ? '✓ Sí'
              : '⚠ No'
          }
        />
        {transaction.extractMismatch ? (
          <ModalField label="Detalle anomalía" value={transaction.extractMismatch} />
        ) : null}
      </dl>
    </div>
  </div>
)

const ModalField = ({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element => (
  <div className="flex justify-between gap-4 border-b border-slate-800 pb-1.5">
    <dt className="text-slate-500">{label}</dt>
    <dd className={`text-slate-200 text-right ${mono ? 'font-mono tabular-nums' : ''}`}>
      {value}
    </dd>
  </div>
)
