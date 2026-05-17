import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { validateTiers, type TierConflict } from '@banex/utils'
import type { CashbackTierDTO } from '@banex/types'
import { api, ApiCallError, type CreateTierPayload } from '../../lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DraftTier {
  level: string
  name: string
  minAmountBOB: string
  maxAmountBOB: string
  rebatePercent: string
  validFromPeriod: string
  validToPeriod: string
}

const currentPeriod = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const emptyDraft = (): DraftTier => ({
  level: '',
  name: '',
  minAmountBOB: '',
  maxAmountBOB: '',
  rebatePercent: '',
  validFromPeriod: currentPeriod(),
  validToPeriod: '',
})

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export function TiersEditor(): JSX.Element {
  const [tiers, setTiers] = useState<CashbackTierDTO[]>([])
  const [history, setHistory] = useState<CashbackTierDTO[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<'active' | 'history'>('active')
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  )
  const [draft, setDraft] = useState<DraftTier>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(
    null,
  )
  const [simulatorDraft, setSimulatorDraft] = useState<
    Array<{
      level: number
      name: string
      minAmountBOB: string
      maxAmountBOB: string | null
      rebatePercent: string
    }> | null
  >(null)

  const load = async (): Promise<void> => {
    try {
      const [active, all] = await Promise.all([api.listTiers(), api.listTiersHistory()])
      setTiers(active)
      setHistory(all)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'simulator') return
    const raw = sessionStorage.getItem('banex:simulator-draft')
    if (!raw) return
    try {
      setSimulatorDraft(JSON.parse(raw))
    } catch {
      /* draft corrupto, se ignora */
    }
  }, [])

  const applySimulatorTier = (tier: {
    level: number
    name: string
    minAmountBOB: string
    maxAmountBOB: string | null
    rebatePercent: string
  }): void => {
    setDraft({
      level: String(tier.level),
      name: tier.name,
      minAmountBOB: tier.minAmountBOB,
      maxAmountBOB: tier.maxAmountBOB ?? '',
      rebatePercent: tier.rebatePercent,
      validFromPeriod: currentPeriod(),
      validToPeriod: '',
    })
    setModal({ mode: 'create' })
    setFeedback(null)
  }

  const validation = useMemo(() => {
    const base = tiers.map((t) => ({
      id: t.id,
      level: t.level,
      name: t.name,
      minAmountBOB: t.minAmountBOB,
      maxAmountBOB: t.maxAmountBOB,
      rebatePercent: t.rebatePercent,
    }))

    if (!modal) return validateTiers(base)

    const others = modal.mode === 'edit' ? base.filter((t) => t.id !== modal.id) : base

    return validateTiers([
      ...others,
      {
        id: modal.mode === 'edit' ? modal.id : 'DRAFT',
        level: Number(draft.level) || 0,
        name: draft.name || 'Nuevo nivel',
        minAmountBOB: draft.minAmountBOB || '0',
        maxAmountBOB: draft.maxAmountBOB.trim() === '' ? null : draft.maxAmountBOB,
        rebatePercent: draft.rebatePercent || '0',
      },
    ])
  }, [tiers, modal, draft])

  const conflictsFor = (id: string | number): TierConflict[] =>
    validation.conflicts.filter((c) => c.tierIds.includes(id))

  const openCreate = (): void => {
    setDraft(emptyDraft())
    setModal({ mode: 'create' })
    setFeedback(null)
  }

  const openEdit = (tier: CashbackTierDTO): void => {
    setDraft({
      level: String(tier.level),
      name: tier.name,
      minAmountBOB: tier.minAmountBOB,
      maxAmountBOB: tier.maxAmountBOB ?? '',
      rebatePercent: tier.rebatePercent,
      validFromPeriod: tier.validFromPeriod,
      validToPeriod: tier.validToPeriod ?? '',
    })
    setModal({ mode: 'edit', id: tier.id })
    setFeedback(null)
  }

  const closeModal = (): void => {
    setModal(null)
    setDraft(emptyDraft())
  }

  const draftFormValid =
    draft.name.trim() !== '' &&
    Number(draft.level) >= 1 &&
    /^\d+(\.\d{1,8})?$/.test(draft.minAmountBOB) &&
    (draft.maxAmountBOB.trim() === '' || /^\d+(\.\d{1,8})?$/.test(draft.maxAmountBOB)) &&
    /^\d+(\.\d{1,2})?$/.test(draft.rebatePercent) &&
    PERIOD_REGEX.test(draft.validFromPeriod) &&
    (draft.validToPeriod.trim() === '' || PERIOD_REGEX.test(draft.validToPeriod))

  const draftId = modal?.mode === 'edit' ? modal.id : 'DRAFT'
  const draftBlocked = validation.conflicts.some(
    (c) => c.severity === 'error' && c.tierIds.includes(draftId),
  )

  const handleSave = async (): Promise<void> => {
    if (!modal) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload: CreateTierPayload = {
        level: Number(draft.level),
        name: draft.name.trim(),
        minAmountBOB: draft.minAmountBOB,
        maxAmountBOB: draft.maxAmountBOB.trim() === '' ? null : draft.maxAmountBOB,
        rebatePercent: draft.rebatePercent,
        validFromPeriod: draft.validFromPeriod,
        validToPeriod: draft.validToPeriod.trim() === '' ? null : draft.validToPeriod,
      }

      if (modal.mode === 'create') {
        await api.createTier(payload)
      } else {
        await api.updateTier(modal.id, payload)
      }

      await load()
      closeModal()
      setFeedback({
        kind: 'success',
        message:
          modal.mode === 'create'
            ? `Nivel creado, vigente desde ${payload.validFromPeriod}.`
            : `Nivel actualizado, vigente desde ${payload.validFromPeriod}.`,
      })
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (tier: CashbackTierDTO): Promise<void> => {
    if (!window.confirm(`¿Desactivar el nivel "${tier.name}"? No se borra el historial.`)) return
    setFeedback(null)
    try {
      await api.deactivateTier(tier.id)
      await load()
      setFeedback({ kind: 'success', message: `Nivel "${tier.name}" desactivado.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    }
  }

  if (status === 'loading') {
    return <TiersEditorSkeleton />
  }
  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudieron cargar los niveles.</AlertTitle>
      </Alert>
    )
  }

  const globalWarnings = validation.conflicts.filter(
    (c) => c.severity === 'warning' && c.tierIds.length === 0,
  )
  const draftConflicts = validation.conflicts.filter((c) => c.tierIds.includes(draftId))

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <Tabs value={view} onValueChange={(v) => setView(v as 'active' | 'history')}>
          <TabsList>
            <TabsTrigger value="active">Niveles activos</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'active' ? (
          <Button type="button" onClick={openCreate}>
            <Plus />
            Añadir nivel
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <Alert
          className={cn(
            'relative',
            feedback.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
          )}
        >
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

      {simulatorDraft && simulatorDraft.length > 0 ? (
        <Alert className="relative border-sky-500/40 bg-sky-500/10 text-sky-100 [&>svg]:text-sky-300">
          <Sparkles />
          <AlertTitle>
            Configuración propuesta desde el simulador ({simulatorDraft.length} niveles)
          </AlertTitle>
          <AlertDescription>
            <p className="mb-3 text-xs text-sky-200/80">
              Revisa cada nivel y aplícalo con su período de vigencia.
            </p>
            <div className="flex flex-wrap gap-2">
              {simulatorDraft.map((t) => (
                <button
                  key={t.level}
                  type="button"
                  onClick={() => applySimulatorTier(t)}
                  className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 font-mono text-xs text-sky-100 transition-colors hover:bg-sky-500/25"
                >
                  {t.name}: {t.rebatePercent}%
                </button>
              ))}
            </div>
          </AlertDescription>
          <button
            type="button"
            onClick={() => setSimulatorDraft(null)}
            className="absolute right-3 top-3 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ) : null}

      {view === 'active' && globalWarnings.length > 0 ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100">
          <AlertDescription>
            {globalWarnings.map((c, i) => (
              <p key={i}>{c.message}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Desde BOB</TableHead>
                <TableHead className="text-right">Hasta BOB</TableHead>
                <TableHead className="text-right">Reintegro</TableHead>
                <TableHead>Vigencia</TableHead>
                {view === 'active' ? (
                  <TableHead className="text-right">Acciones</TableHead>
                ) : (
                  <TableHead>Estado</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {view === 'active' ? (
                tiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay niveles activos. Añade el primero.
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers.map((tier) => {
                    const rowConflicts = conflictsFor(tier.id)
                    const hasError = rowConflicts.some((c) => c.severity === 'error')
                    const hasWarning = rowConflicts.some((c) => c.severity === 'warning')
                    return (
                      <TableRow
                        key={tier.id}
                        className={cn(
                          'align-top',
                          hasError && 'bg-destructive/10',
                          !hasError && hasWarning && 'bg-amber-500/10',
                        )}
                      >
                        <TableCell className="font-mono text-sm">{tier.level}</TableCell>
                        <TableCell>
                          <p className="font-medium">{tier.name}</p>
                          {rowConflicts.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {rowConflicts.map((c, i) => (
                                <p
                                  key={i}
                                  className={cn(
                                    'text-[11px]',
                                    c.severity === 'error' ? 'text-red-300' : 'text-amber-300',
                                  )}
                                >
                                  {c.message}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {tier.minAmountBOB}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {tier.maxAmountBOB ?? (
                            <span className="text-muted-foreground">Sin tope</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-400">
                          {tier.rebatePercent}%
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tier.validFromPeriod}
                          {' – '}
                          {tier.validToPeriod ?? (
                            <span className="text-muted-foreground">actual</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(tier)}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void handleDeactivate(tier)}
                            >
                              Desactivar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No hay historial.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((tier) => (
                  <TableRow key={tier.id} className="align-top">
                    <TableCell className="font-mono text-sm">{tier.level}</TableCell>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {tier.minAmountBOB}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {tier.maxAmountBOB ?? (
                        <span className="text-muted-foreground">Sin tope</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-400">
                      {tier.rebatePercent}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tier.validFromPeriod}
                      {' – '}
                      {tier.validToPeriod ?? (
                        <span className="text-muted-foreground">actual</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tier.active ? (
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={modal !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal?.mode === 'create' ? 'Añadir nivel' : 'Editar nivel'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nivel" htmlFor="tier-level">
              <Input
                id="tier-level"
                type="number"
                min={1}
                value={draft.level}
                onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
              />
            </FormField>
            <FormField label="Nombre" htmlFor="tier-name">
              <Input
                id="tier-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Desde BOB" htmlFor="tier-min">
              <Input
                id="tier-min"
                type="text"
                inputMode="decimal"
                value={draft.minAmountBOB}
                onChange={(e) => setDraft((d) => ({ ...d, minAmountBOB: e.target.value }))}
              />
            </FormField>
            <FormField label="Hasta BOB (vacío = sin tope)" htmlFor="tier-max">
              <Input
                id="tier-max"
                type="text"
                inputMode="decimal"
                value={draft.maxAmountBOB}
                onChange={(e) => setDraft((d) => ({ ...d, maxAmountBOB: e.target.value }))}
              />
            </FormField>
            <FormField label="Reintegro %" htmlFor="tier-rebate">
              <Input
                id="tier-rebate"
                type="text"
                inputMode="decimal"
                value={draft.rebatePercent}
                onChange={(e) => setDraft((d) => ({ ...d, rebatePercent: e.target.value }))}
              />
            </FormField>
            <FormField label="Vigente desde (YYYY-MM)" htmlFor="tier-from">
              <Input
                id="tier-from"
                type="text"
                placeholder="2025-05"
                value={draft.validFromPeriod}
                onChange={(e) => setDraft((d) => ({ ...d, validFromPeriod: e.target.value }))}
              />
            </FormField>
            <FormField label="Vigente hasta (opcional)" htmlFor="tier-to">
              <Input
                id="tier-to"
                type="text"
                placeholder="vacío = sin fin"
                value={draft.validToPeriod}
                onChange={(e) => setDraft((d) => ({ ...d, validToPeriod: e.target.value }))}
              />
            </FormField>
          </div>

          {draftConflicts.length > 0 ? (
            <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
              {draftConflicts.map((c, i) => (
                <p
                  key={i}
                  className={cn(
                    'text-xs',
                    c.severity === 'error' ? 'text-red-300' : 'text-amber-300',
                  )}
                >
                  {c.severity === 'error' ? '✕' : '⚠'} {c.message}
                </p>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!draftFormValid || draftBlocked || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

const errorMessage = (error: unknown): string =>
  error instanceof ApiCallError
    ? error.payload.message
    : error instanceof Error
      ? error.message
      : 'Operación fallida.'

function TiersEditorSkeleton(): JSX.Element {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="inline-flex rounded-md border border-slate-800 bg-slate-900/40 p-1">
          <div className="h-8 w-28 rounded skeleton-block" />
          <div className="ml-1 h-8 w-20 rounded skeleton-block" />
        </div>
        <div className="h-10 w-32 rounded-md skeleton-block" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-widest text-slate-500">
            <tr>
              {['Nivel', 'Nombre', 'Desde BOB', 'Hasta BOB', 'Reintegro', 'Vigencia', 'Acciones'].map((label, index) => {
                const right = (index >= 2 && index <= 4) || index === 6
                return (
                  <th key={label} className={`px-4 py-3 ${right ? 'text-right' : 'text-left'}`}>
                    <div className={`h-3 rounded skeleton-block ${right ? 'ml-auto w-16' : 'w-20'}`} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 bg-slate-900/30">
            {Array.from({ length: 5 }).map((_, row) => (
              <tr key={row}>
                <td className="px-4 py-3"><div className="h-4 w-8 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="h-4 w-28 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-14 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="h-4 w-32 rounded skeleton-block" /></td>
                <td className="px-4 py-3"><div className="ml-auto h-4 w-28 rounded skeleton-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
