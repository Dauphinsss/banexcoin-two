import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

  return (
    <Sheet open={rebate !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-2xl"
      >
        {rebate ? (
          <>
            <SheetHeader className="border-b border-border bg-background/80 px-6 py-5 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Detalle de usuario
              </p>
              <SheetTitle className="truncate text-lg">{rebate.username}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                Cuenta {rebate.userId}
              </SheetDescription>
            </SheetHeader>

            <section className="space-y-4 border-b border-border px-6 py-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SummaryRow label="Total gastado">
                  <span className="font-mono tabular-nums">{formatBOB(rebate.totalSpentBOB)}</span>
                </SummaryRow>
                <SummaryRow label="Nivel">
                  <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                    {rebate.tierName ?? 'Sin nivel'}
                  </Badge>
                </SummaryRow>
                <SummaryRow label="% Cashback">
                  <span className="font-mono tabular-nums">{formatPercent(rebate.rebatePercent)}</span>
                </SummaryRow>
                <SummaryRow label="T/C promedio">
                  <span className="font-mono tabular-nums">{formatRate(rebate.avgExchangeRate)}</span>
                </SummaryRow>
                <SummaryRow label="Reintegro USDT" highlight>
                  <span className="font-mono text-base font-semibold tabular-nums text-emerald-400">
                    {formatUSDT(rebate.rebateUSDT)}
                  </span>
                </SummaryRow>
                <SummaryRow label="Reintegro BOB">
                  <span className="font-mono tabular-nums">{formatBOB(rebate.rebateBOB)}</span>
                </SummaryRow>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {rebate.transactionCount} transacciones · período {rebate.period}
                </span>
                {rebate.paidOut ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Pagado el {formatDateTime(rebate.paidOutAt)}
                  </span>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                    Pendiente de pago
                  </Badge>
                )}
              </div>
            </section>

            <section className="px-6 py-5">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Transacciones del período
              </h3>
              {status === 'loading' ? (
                <TransactionsSkeleton />
              ) : status === 'error' ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin transacciones para mostrar.</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">BOB</TableHead>
                        <TableHead className="text-right">USDT</TableHead>
                        <TableHead className="text-right">T/C</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow
                          key={tx.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedTx(tx)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {formatDateTime(tx.transactedAt).slice(0, 16)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatBOB(tx.amountBOB)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {formatUSDTCompact(tx.amountUSDT)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {formatRate(tx.exchangeRate)}
                          </TableCell>
                          <TableCell className="text-center">
                            {tx.reconciledWithExtract ? (
                              <CheckCircle2
                                className="mx-auto size-4 text-emerald-400"
                                aria-label="Conciliada con extracto"
                              />
                            ) : (
                              <TriangleAlert
                                className="mx-auto size-4 text-amber-400"
                                aria-label="Sin conciliar"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </SheetContent>

      {selectedTx ? (
        <TransactionDialog transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      ) : null}
    </Sheet>
  )
}

export default UserDrawer

const SummaryRow = ({
  label,
  children,
  highlight = false,
}: {
  label: string
  children: ReactNode
  highlight?: boolean
}): JSX.Element => (
  <div
    className={cn(
      'rounded-md border px-3 py-2',
      highlight
        ? 'border-emerald-500/30 bg-emerald-500/10'
        : 'border-border bg-muted/30',
    )}
  >
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
)

const TransactionDialog = ({
  transaction,
  onClose,
}: {
  transaction: QRTransactionDTO
  onClose: () => void
}): JSX.Element => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Transacción QR</DialogTitle>
      </DialogHeader>
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
            transaction.reconciledWithExtract ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Sí
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400">
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
    </DialogContent>
  </Dialog>
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
  value: ReactNode
  mono?: boolean
}): JSX.Element => (
  <div className="flex items-center justify-between gap-4 border-b border-border pb-1.5 last:border-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={cn('text-right text-foreground', mono && 'font-mono tabular-nums')}>{value}</dd>
  </div>
)
