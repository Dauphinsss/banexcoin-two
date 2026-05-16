import { useEffect, useState, type JSX } from 'react'
import { Check, CircleCheck, TriangleAlert, X } from 'lucide-react'
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
      className="fixed inset-0 z-40 flex justify-end bg-overlay backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className="h-full w-full max-w-2xl bg-app border-l border-line shadow-2xl overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slide-in 250ms ease-in-out' }}
      >
        <header className="sticky top-0 z-10 bg-app-glass border-b border-line px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-faint">Detalle de usuario</p>
            <h2 className="mt-1 text-lg font-semibold text-main truncate">{rebate.username}</h2>
            <p className="text-xs text-faint font-mono">Cuenta {rebate.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover-text-soft px-2"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <section className="px-6 py-5 space-y-4 border-b border-line">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryRow label="Total gastado" value={formatBOB(rebate.totalSpentBOB)} />
            <SummaryRow
              label="Nivel"
              value={
                <span className="rounded-md border border-brand-muted bg-brand-soft px-2 py-1 text-xs text-brand-soft">
                  {rebate.tierName ?? 'Sin nivel'}
                </span>
              }
            />
            <SummaryRow label="% Cashback" value={formatPercent(rebate.rebatePercent)} />
            <SummaryRow
              label="T/C promedio"
              value={
                <span className="font-mono tabular-nums text-soft">
                  {formatRate(rebate.avgExchangeRate)}
                </span>
              }
            />
            <SummaryRow
              label="Reintegro USDT"
              value={
                <span className="font-mono tabular-nums text-success">
                  {formatUSDT(rebate.rebateUSDT)}
                </span>
              }
              highlight
            />
            <SummaryRow
              label="Reintegro BOB"
              value={
                <span className="font-mono tabular-nums text-soft">
                  {formatBOB(rebate.rebateBOB)}
                </span>
              }
            />
          </div>

          <div className="flex items-center justify-between text-xs text-faint">
            <span>{rebate.transactionCount} transacciones · período {rebate.period}</span>
            <span className={rebate.paidOut ? 'text-success-strong' : ''}>
              {rebate.paidOut
                ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3.5" aria-hidden="true" />
                    Pagado el {formatDateTime(rebate.paidOutAt)}
                  </span>
                )
                : 'Pendiente de pago'}
            </span>
          </div>
        </section>

        <section className="px-6 py-5">
          <h3 className="text-sm font-medium text-muted mb-3">Transacciones del período</h3>
          {status === 'loading' ? (
            <TransactionsSkeleton />
          ) : status === 'error' ? (
            <p className="text-sm text-danger">{errorMessage}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted">Sin transacciones para mostrar.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-line">
              <table className="min-w-full text-xs">
                <thead className="bg-panel-solid text-faint uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-right">BOB</th>
                    <th className="px-3 py-2 text-right">USDT</th>
                    <th className="px-3 py-2 text-right">T/C</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-dark">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover-bg-panel-hover-muted cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="px-3 py-2 text-muted font-mono">
                        {formatDateTime(tx.transactedAt).slice(0, 16)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-soft">
                        {formatBOB(tx.amountBOB)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                        {formatUSDTCompact(tx.amountUSDT)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                        {formatRate(tx.exchangeRate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {tx.reconciledWithExtract ? (
                          <CircleCheck className="mx-auto size-4 text-success-strong" aria-label="Conciliada con extracto" />
                        ) : (
                          <TriangleAlert className="mx-auto size-4 text-warning-strong" aria-label="Sin conciliar" />
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
        ? 'border-success-muted bg-success-faint'
        : 'border-line bg-panel'
    }`}
  >
    <p className="text-xs text-faint">{label}</p>
    <div className="mt-1 text-main">{value}</div>
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
    className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-strong p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="w-full max-w-lg rounded-lg border border-line-strong bg-app p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-main">Transacción QR</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover-text-soft"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden="true" />
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
              ? (
                <span className="inline-flex items-center gap-1 text-success-strong">
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Sí
                </span>
              )
              : (
                <span className="inline-flex items-center gap-1 text-warning-strong">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  No
                </span>
              )
          }
        />
        {transaction.extractMismatch ? (
          <ModalField label="Detalle anomalía" value={transaction.extractMismatch} />
        ) : null}
      </dl>
    </div>
  </div>
)

const TransactionsSkeleton = (): JSX.Element => (
  <div className="overflow-hidden rounded-md border border-line" aria-hidden="true">
    <table className="min-w-full text-xs">
      <thead className="bg-panel-solid text-faint uppercase tracking-wider">
        <tr>
          {['Fecha', 'BOB', 'USDT', 'T/C', 'Estado'].map((label, index) => (
            <th key={label} className={`px-3 py-2 ${index === 0 ? 'text-left' : index === 4 ? 'text-center' : 'text-right'}`}>
              <div className={`h-3 rounded skeleton-block ${index === 0 ? 'w-16' : index === 4 ? 'mx-auto w-12' : 'ml-auto w-12'}`} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line-dark">
        {Array.from({ length: 6 }).map((_, row) => (
          <tr key={row}>
            <td className="px-3 py-2"><div className="h-4 w-28 rounded skeleton-block" /></td>
            <td className="px-3 py-2"><div className="ml-auto h-4 w-16 rounded skeleton-block" /></td>
            <td className="px-3 py-2"><div className="ml-auto h-4 w-16 rounded skeleton-block" /></td>
            <td className="px-3 py-2"><div className="ml-auto h-4 w-12 rounded skeleton-block" /></td>
            <td className="px-3 py-2"><div className="mx-auto size-4 rounded-full skeleton-block" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const ModalField = ({
  label,
  value,
  mono = false,
}: {
  label: string
  value: JSX.Element | string
  mono?: boolean
}): JSX.Element => (
  <div className="flex justify-between gap-4 border-b border-line pb-1.5">
    <dt className="text-faint">{label}</dt>
    <dd className={`text-soft text-right ${mono ? 'font-mono tabular-nums' : ''}`}>
      {value}
    </dd>
  </div>
)
