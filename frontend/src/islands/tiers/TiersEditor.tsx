import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Sparkles, X } from 'lucide-react'
import { validateTiers, type TierConflict } from '@banex/utils'
import type { CashbackTierDTO } from '@banex/types'
import { api, ApiCallError, type CreateTierPayload, type TierInput } from '../../lib/api'
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

const nextPeriod = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month === 12) return `${year + 1}-01`
  return `${year}-${String(month + 1).padStart(2, '0')}`
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
  const [modal, setModal] = useState<{ mode: 'edit'; id: string } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishPeriod, setPublishPeriod] = useState(nextPeriod())
  const [publishToPeriod, setPublishToPeriod] = useState('')
  const [publishDraft, setPublishDraft] = useState<TierInput[]>([])
  const [publishDragIndex, setPublishDragIndex] = useState<number | null>(null)
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

    const others = base.filter((t) => t.id !== modal.id)

    return validateTiers([
      ...others,
      {
        id: modal.id,
        level: Number(draft.level) || 0,
        name: draft.name || 'Nivel editado',
        minAmountBOB: draft.minAmountBOB || '0',
        maxAmountBOB: draft.maxAmountBOB.trim() === '' ? null : draft.maxAmountBOB,
        rebatePercent: draft.rebatePercent || '0',
      },
    ])
  }, [tiers, modal, draft])

  const publishValidation = useMemo(
    () =>
      validateTiers(
        publishDraft.map((tier, index) => ({
          id: tier.id ?? `draft-${index}`,
          level: tier.level || index + 1,
          name: tier.name || `Nivel ${index + 1}`,
          minAmountBOB: tier.minAmountBOB || '0',
          maxAmountBOB:
            tier.maxAmountBOB == null || tier.maxAmountBOB === '' ? null : tier.maxAmountBOB,
          rebatePercent: tier.rebatePercent || '0',
        })),
      ),
    [publishDraft],
  )

  const conflictsFor = (id: string | number): TierConflict[] =>
    validation.conflicts.filter((c) => c.tierIds.includes(id))

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

  const openPublish = (): void => {
    const base = tiers
      .slice()
      .sort((left, right) => left.level - right.level)
      .map((tier) => ({
        level: tier.level,
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
      }))

    setPublishDraft(base.length > 0 ? renumberTiers(base) : insertPublishTier([], 0))
    setPublishPeriod(nextPeriod())
    setPublishToPeriod('')
    setPublishOpen(true)
    setFeedback(null)
  }

  const closePublish = (): void => {
    setPublishOpen(false)
    setPublishPeriod(nextPeriod())
    setPublishToPeriod('')
    setPublishDraft([])
    setPublishDragIndex(null)
  }

  const applySimulatorConfiguration = (): void => {
    if (!simulatorDraft || simulatorDraft.length === 0) return
    const seeded = simulatorDraft
      .slice()
      .sort((left, right) => left.level - right.level)
      .map((tier) => ({
        level: tier.level,
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
      }))

    setPublishDraft(renumberTiers(seeded))
    setPublishPeriod(nextPeriod())
    setPublishToPeriod('')
    setPublishOpen(true)
    setFeedback(null)
  }

  const draftFormValid =
    draft.name.trim() !== '' &&
    Number(draft.level) >= 1 &&
    /^\d+(\.\d{1,8})?$/.test(draft.minAmountBOB) &&
    (draft.maxAmountBOB.trim() === '' || /^\d+(\.\d{1,8})?$/.test(draft.maxAmountBOB)) &&
    /^\d+(\.\d{1,2})?$/.test(draft.rebatePercent) &&
    PERIOD_REGEX.test(draft.validFromPeriod) &&
    (draft.validToPeriod.trim() === '' || PERIOD_REGEX.test(draft.validToPeriod))

  const draftId = modal?.id ?? 'DRAFT'
  const draftBlocked = validation.conflicts.some(
    (c) => c.severity === 'error' && c.tierIds.includes(draftId),
  )

  const publishFormValid =
    PERIOD_REGEX.test(publishPeriod) &&
    (publishToPeriod.trim() === '' ||
      (PERIOD_REGEX.test(publishToPeriod) && publishToPeriod >= publishPeriod)) &&
    publishDraft.length > 0 &&
    publishDraft.every(
      (tier) =>
        tier.name.trim() !== '' &&
        Number(tier.level) >= 1 &&
        /^\d+(\.\d{1,8})?$/.test(tier.minAmountBOB) &&
        (tier.maxAmountBOB == null ||
          tier.maxAmountBOB === '' ||
          /^\d+(\.\d{1,8})?$/.test(tier.maxAmountBOB)) &&
        /^\d+(\.\d{1,2})?$/.test(tier.rebatePercent),
    )

  const publishBlocked = publishValidation.conflicts.some((conflict) => conflict.severity === 'error')

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

      await api.updateTier(modal.id, payload)

      await load()
      closeModal()
      setFeedback({
        kind: 'success',
        message: `Nivel actualizado, vigente desde ${payload.validFromPeriod}.`,
      })
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (): Promise<void> => {
    setSaving(true)
    setFeedback(null)
    try {
      await api.publishTierConfiguration({
        validFromPeriod: publishPeriod,
        validToPeriod: publishToPeriod.trim() === '' ? null : publishToPeriod,
        tiers: publishDraft.map((tier, index) => ({
          level: index + 1,
          name: tier.name.trim(),
          minAmountBOB: tier.minAmountBOB,
          maxAmountBOB: tier.maxAmountBOB == null || tier.maxAmountBOB === '' ? null : tier.maxAmountBOB,
          rebatePercent: tier.rebatePercent,
        })),
      })

      await load()
      closePublish()
      setFeedback({
        kind: 'success',
        message:
          publishToPeriod.trim() === ''
            ? `Configuracion publicada desde ${publishPeriod}.`
            : `Configuracion publicada desde ${publishPeriod} hasta ${publishToPeriod}.`,
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

  const updatePublishTier = (
    index: number,
    field: keyof Omit<TierInput, 'id'>,
    value: string,
  ): void => {
    setPublishDraft((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [field]:
                field === 'level'
                  ? Number(value) || tier.level
                  : value,
            }
          : tier,
      ),
    )
  }

  const addPublishTier = (): void => {
    setPublishDraft((current) => insertPublishTier(current, current.length))
  }

  const insertPublishTierAfter = (index: number): void => {
    setPublishDraft((current) => insertPublishTier(current, index + 1))
  }

  const movePublishTier = (index: number, direction: -1 | 1): void => {
    setPublishDraft((current) => reorderTier(current, index, index + direction))
  }

  const dropPublishTier = (targetIndex: number): void => {
    setPublishDraft((current) => {
      if (publishDragIndex == null) return current
      return reorderTier(current, publishDragIndex, targetIndex)
    })
    setPublishDragIndex(null)
  }

  const removePublishTier = (index: number): void => {
    setPublishDraft((current) => renumberTiers(current.filter((_, tierIndex) => tierIndex !== index)))
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
        <Tabs value={view} onValueChange={(v) => setView(v as 'active' | 'history')} className="min-w-0">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active">Niveles activos</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'active' ? (
          <Button type="button" onClick={openPublish}>
            <Sparkles />
            Publicar configuracion
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
            Configuracion propuesta desde el simulador ({simulatorDraft.length} niveles)
          </AlertTitle>
          <AlertDescription>
            <p className="mb-3 text-xs text-sky-200/80">
              Revisala y publícala como una configuracion completa desde el periodo que corresponda.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applySimulatorConfiguration}>
                Usar propuesta
              </Button>
              <button
                type="button"
                onClick={() => setSimulatorDraft(null)}
                className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 transition-colors hover:bg-sky-500/25"
              >
                Descartar
              </button>
            </div>
          </AlertDescription>
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
          <Table className="min-w-[760px]">
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
                      No hay niveles activos. Publica la primera configuracion.
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
                          {' - '}
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
                history.map((tier) => {
                  const status = tierLifecycleStatus(tier)
                  return (
                    <TableRow
                      key={tier.id}
                      className={cn(
                        'align-top',
                        status.muted && 'text-muted-foreground/80 opacity-80',
                        status.rowClassName,
                      )}
                    >
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
                      <TableCell
                        className={cn(
                          'text-right font-mono text-sm tabular-nums',
                          status.rebateClassName,
                        )}
                      >
                        {tier.rebatePercent}%
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tier.validFromPeriod}
                        {' - '}
                        {tier.validToPeriod ?? (
                          <span className="text-muted-foreground">actual</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.badgeClassName}>
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={publishOpen} onOpenChange={(open) => !open && closePublish()}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Publicar configuracion de niveles</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="grid gap-4 md:grid-cols-[220px_220px_1fr]">
              <FormField label="Vigente desde (YYYY-MM)" htmlFor="publish-tier-from">
                <Input
                  id="publish-tier-from"
                  type="text"
                  placeholder="2026-05"
                  value={publishPeriod}
                  onChange={(e) => setPublishPeriod(e.target.value)}
                />
              </FormField>
              <FormField label="Vigente hasta (opcional)" htmlFor="publish-tier-to">
                <Input
                  id="publish-tier-to"
                  type="text"
                  placeholder="Sin fin"
                  value={publishToPeriod}
                  onChange={(e) => setPublishToPeriod(e.target.value)}
                />
              </FormField>
              <div className="flex items-end justify-start md:justify-end">
                <Button type="button" variant="outline" onClick={addPublishTier}>
                  <Plus />
                  Añadir nivel
                </Button>
              </div>
            </div>

            {publishToPeriod.trim() !== '' &&
            (!PERIOD_REGEX.test(publishToPeriod) || publishToPeriod < publishPeriod) ? (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100">
                <AlertDescription>
                  El periodo final debe tener formato YYYY-MM y no puede ser anterior al inicio.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead className="w-16">Nivel</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="min-w-[140px]">Desde BOB</TableHead>
                    <TableHead className="min-w-[140px]">Hasta BOB</TableHead>
                    <TableHead className="min-w-[140px]">Reintegro %</TableHead>
                    <TableHead className="w-40 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publishDraft.map((tier, index) => {
                    const rowId = tier.id ?? `draft-${index}`
                    const rowConflicts = publishValidation.conflicts.filter((conflict) =>
                      conflict.tierIds.includes(rowId),
                    )
                    const hasError = rowConflicts.some((conflict) => conflict.severity === 'error')
                    return (
                      <TableRow
                        key={rowId}
                        draggable
                        onDragStart={() => setPublishDragIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropPublishTier(index)}
                        onDragEnd={() => setPublishDragIndex(null)}
                        className={cn(
                          'align-top',
                          publishDragIndex === index && 'opacity-60',
                          hasError && 'bg-destructive/10',
                        )}
                      >
                        <TableCell className="pt-4">
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Arrastrar nivel ${index + 1}`}
                          >
                            <GripVertical className="size-4" />
                          </button>
                        </TableCell>
                        <TableCell className="pt-3">
                          <Input
                            value={String(index + 1)}
                            readOnly
                            className="text-center font-mono"
                          />
                        </TableCell>
                        <TableCell className="space-y-1 pt-3">
                          <Input
                            value={tier.name}
                            onChange={(event) =>
                              updatePublishTier(index, 'name', event.target.value)
                            }
                            placeholder={`Nivel ${index + 1}`}
                          />
                          {rowConflicts.map((conflict, conflictIndex) => (
                            <p
                              key={conflictIndex}
                              className={cn(
                                'text-[11px]',
                                conflict.severity === 'error' ? 'text-red-300' : 'text-amber-300',
                              )}
                            >
                              {conflict.message}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="pt-3">
                          <Input
                            inputMode="decimal"
                            value={tier.minAmountBOB}
                            onChange={(event) =>
                              updatePublishTier(index, 'minAmountBOB', event.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="pt-3">
                          <Input
                            inputMode="decimal"
                            value={tier.maxAmountBOB ?? ''}
                            placeholder="Sin tope"
                            onChange={(event) =>
                              updatePublishTier(index, 'maxAmountBOB', event.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="pt-3">
                          <Input
                            inputMode="decimal"
                            value={tier.rebatePercent}
                            onChange={(event) =>
                              updatePublishTier(index, 'rebatePercent', event.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="pt-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => movePublishTier(index, -1)}
                              disabled={index === 0}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => movePublishTier(index, 1)}
                              disabled={index === publishDraft.length - 1}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => insertPublishTierAfter(index)}
                            >
                              <Plus />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removePublishTier(index)}
                              disabled={publishDraft.length === 1}
                            >
                              <X />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {publishValidation.conflicts.filter((conflict) => conflict.tierIds.length === 0).length > 0 ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
                {publishValidation.conflicts
                  .filter((conflict) => conflict.tierIds.length === 0)
                  .map((conflict, index) => (
                    <p
                      key={index}
                      className={cn(
                        'text-xs',
                        conflict.severity === 'error' ? 'text-red-300' : 'text-amber-300',
                      )}
                    >
                      {conflict.message}
                    </p>
                  ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePublish}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!publishFormValid || publishBlocked || saving}
              onClick={() => void handlePublish()}
            >
              {saving ? 'Publicando...' : 'Publicar configuracion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar nivel</DialogTitle>
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
            <FormField label="Hasta BOB (vacio = sin tope)" htmlFor="tier-max">
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
                placeholder="vacio = sin fin"
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
                  {c.severity === 'error' ? 'x' : '!'} {c.message}
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
              {saving ? 'Guardando...' : 'Guardar'}
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
      : 'Operacion fallida.'

function tierLifecycleStatus(tier: CashbackTierDTO): {
  label: string
  badgeClassName: string
  rebateClassName: string
  rowClassName?: string
  muted?: boolean
} {
  const period = currentPeriod()

  if (!tier.active) {
    return {
      label: 'Inactivo',
      badgeClassName: 'text-muted-foreground',
      rebateClassName: 'text-muted-foreground',
      muted: true,
    }
  }

  if (tier.validFromPeriod > period) {
    return {
      label: 'Programado',
      badgeClassName: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
      rebateClassName: 'text-sky-300',
      rowClassName: 'bg-sky-500/[0.03]',
    }
  }

  if (tier.validToPeriod != null && tier.validToPeriod < period) {
    return {
      label: 'Expirado',
      badgeClassName: 'text-muted-foreground',
      rebateClassName: 'text-muted-foreground',
      muted: true,
    }
  }

  if (tier.validToPeriod === period) {
    return {
      label: 'Cierra este mes',
      badgeClassName: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
      rebateClassName: 'text-amber-300',
    }
  }

  return {
    label: 'Vigente',
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    rebateClassName: 'text-emerald-400',
  }
}

function renumberTiers(tiers: TierInput[]): TierInput[] {
  return tiers.map((tier, index) => ({
    ...tier,
    level: index + 1,
  }))
}

function reorderTier(tiers: TierInput[], from: number, to: number): TierInput[] {
  if (from === to || to < 0 || to >= tiers.length) return tiers
  const next = tiers.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return renumberTiers(next)
}

function insertPublishTier(tiers: TierInput[], insertAt: number): TierInput[] {
  const base = renumberTiers(tiers)
  const previous = base[insertAt - 1]
  const next = base[insertAt]

  const previousAdjusted =
    previous && (previous.maxAmountBOB == null || previous.maxAmountBOB === '')
      ? {
          ...previous,
          maxAmountBOB: previous.minAmountBOB,
        }
      : previous

  const withPrevious =
    previousAdjusted && previous
      ? base.map((tier, index) => (index === insertAt - 1 ? previousAdjusted : tier))
      : base

  const minFromPrevious =
    previousAdjusted?.maxAmountBOB && previousAdjusted.maxAmountBOB !== ''
      ? incrementDecimal(previousAdjusted.maxAmountBOB)
      : previousAdjusted?.minAmountBOB
        ? incrementDecimal(previousAdjusted.minAmountBOB)
        : '0'

  const maxFromNext =
    next?.minAmountBOB && next.minAmountBOB !== '' ? decrementDecimal(next.minAmountBOB) : null

  const draft: TierInput = {
    level: insertAt + 1,
    name: '',
    minAmountBOB: minFromPrevious,
    maxAmountBOB: maxFromNext,
    rebatePercent: previousAdjusted?.rebatePercent ?? next?.rebatePercent ?? '0',
  }

  const nextTiers = withPrevious.slice()
  nextTiers.splice(insertAt, 0, draft)
  return renumberTiers(nextTiers)
}

function incrementDecimal(value: string): string {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return value
  return (Math.round((parsed + 0.01) * 100) / 100).toFixed(2)
}

function decrementDecimal(value: string): string {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return value
  return (Math.round((parsed - 0.01) * 100) / 100).toFixed(2)
}

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

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-[760px] divide-y divide-slate-800 text-sm">
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
