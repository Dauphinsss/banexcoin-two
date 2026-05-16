import { useEffect, useMemo, useState, type JSX } from 'react'
import { validateTiers, type TierConflict } from '@banex/utils'
import type { CashbackTierDTO } from '@banex/types'
import { api, ApiCallError, type CreateTierPayload } from '../../lib/api'

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

  // Handoff desde el simulador (F8.1): si llega ?from=simulator y hay un draft
  // guardado, lo mostramos como aviso para que Lorena lo aplique manualmente
  // revisando período de vigencia.
  const [simulatorDraft, setSimulatorDraft] = useState<
    Array<{ level: number; name: string; minAmountBOB: string; maxAmountBOB: string | null; rebatePercent: string }> | null
  >(null)

  useEffect(() => {
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

  // Validación inline en cliente: usa la MISMA función pura del backend.
  // Cuando hay modal abierto, valida el set resultante (activos + draft).
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

    const others =
      modal.mode === 'edit' ? base.filter((t) => t.id !== modal.id) : base

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

  // Solo bloquean los conflictos de severidad error que tocan al draft.
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

  if (status === 'loading')
    return <p className="text-sm text-slate-400">Cargando niveles...</p>
  if (status === 'error')
    return <p className="text-sm text-red-300">No se pudieron cargar los niveles.</p>

  const globalWarnings = validation.conflicts.filter(
    (c) => c.severity === 'warning' && c.tierIds.length === 0,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="inline-flex rounded-md border border-slate-800 bg-slate-900/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setView('active')}
            className={`px-3 py-1.5 rounded ${view === 'active' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Niveles activos
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`px-3 py-1.5 rounded ${view === 'history' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Historial
          </button>
        </div>
        {view === 'active' ? (
          <button
            type="button"
            onClick={openCreate}
            className="h-10 px-4 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-500"
          >
            Añadir nivel
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {simulatorDraft && simulatorDraft.length > 0 ? (
        <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-100">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              Configuración propuesta desde el simulador ({simulatorDraft.length} niveles)
            </p>
            <button
              type="button"
              onClick={() => setSimulatorDraft(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-xs text-blue-200/80">
            Revisa cada nivel y aplícalo con su período de vigencia.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {simulatorDraft.map((t) => (
              <button
                key={t.level}
                type="button"
                onClick={() => applySimulatorTier(t)}
                className="rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 font-mono text-xs text-blue-100 hover:bg-blue-500/25"
              >
                {t.name}: {t.rebatePercent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'active' && globalWarnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {globalWarnings.map((c, i) => (
            <p key={i}>{c.message}</p>
          ))}
        </div>
      ) : null}

      {view === 'active' ? (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 text-right">Desde BOB</th>
                <th className="px-4 py-3 text-right">Hasta BOB</th>
                <th className="px-4 py-3 text-right">Reintegro</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 bg-slate-900/30">
              {tiers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                    No hay niveles activos. Añade el primero.
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => {
                  const rowConflicts = conflictsFor(tier.id)
                  const hasError = rowConflicts.some((c) => c.severity === 'error')
                  const hasWarning = rowConflicts.some((c) => c.severity === 'warning')
                  const rowClass = hasError
                    ? 'bg-red-500/10'
                    : hasWarning
                      ? 'bg-amber-500/10'
                      : 'hover:bg-slate-800/40'
                  return (
                    <tr key={tier.id} className={`align-top ${rowClass}`}>
                      <td className="px-4 py-3 font-mono text-slate-300">{tier.level}</td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {tier.name}
                        {rowConflicts.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {rowConflicts.map((c, i) => (
                              <p
                                key={i}
                                className={`text-[11px] ${c.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}
                              >
                                {c.message}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                        {tier.minAmountBOB}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                        {tier.maxAmountBOB ?? 'Sin tope'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-200">
                        {tier.rebatePercent}%
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {tier.validFromPeriod} – {tier.validToPeriod ?? 'actual'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(tier)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(tier)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Desactivar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 text-right">Desde BOB</th>
                <th className="px-4 py-3 text-right">Hasta BOB</th>
                <th className="px-4 py-3 text-right">Reintegro</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 bg-slate-900/30">
              {history.map((tier) => (
                <tr key={tier.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-slate-300">{tier.level}</td>
                  <td className="px-4 py-3 font-medium text-slate-100">{tier.name}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                    {tier.minAmountBOB}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                    {tier.maxAmountBOB ?? 'Sin tope'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-200">
                    {tier.rebatePercent}%
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {tier.validFromPeriod} – {tier.validToPeriod ?? 'actual'}
                  </td>
                  <td className="px-4 py-3">
                    {tier.active ? (
                      <span className="text-xs text-emerald-300">Activo</span>
                    ) : (
                      <span className="text-xs text-slate-500">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-100">
              {modal.mode === 'create' ? 'Añadir nivel' : 'Editar nivel'}
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Nivel">
                <input
                  type="number"
                  min={1}
                  value={draft.level}
                  onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Nombre">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Desde BOB">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.minAmountBOB}
                  onChange={(e) => setDraft((d) => ({ ...d, minAmountBOB: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Hasta BOB (vacío = sin tope)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.maxAmountBOB}
                  onChange={(e) => setDraft((d) => ({ ...d, maxAmountBOB: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Reintegro %">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.rebatePercent}
                  onChange={(e) => setDraft((d) => ({ ...d, rebatePercent: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Vigente desde (YYYY-MM)">
                <input
                  type="text"
                  placeholder="2025-05"
                  value={draft.validFromPeriod}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, validFromPeriod: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Vigente hasta (opcional)">
                <input
                  type="text"
                  placeholder="vacío = sin fin"
                  value={draft.validToPeriod}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, validToPeriod: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            {validation.conflicts.filter((c) => c.tierIds.includes(draftId)).length > 0 ? (
              <div className="mt-4 space-y-1">
                {validation.conflicts
                  .filter((c) => c.tierIds.includes(draftId))
                  .map((c, i) => (
                    <p
                      key={i}
                      className={`text-xs ${c.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}
                    >
                      {c.severity === 'error' ? '✕' : '⚠'} {c.message}
                    </p>
                  ))}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 px-4 rounded-md border border-slate-700 text-sm text-slate-200 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!draftFormValid || draftBlocked || saving}
                onClick={() => void handleSave()}
                className="h-10 px-4 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const inputClass =
  'h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 outline-none focus:border-blue-500'

function Field({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const errorMessage = (error: unknown): string =>
  error instanceof ApiCallError
    ? error.payload.message
    : error instanceof Error
      ? error.message
      : 'Operación fallida.'
