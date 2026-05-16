/**
 * Errores de dominio del módulo de tiers.
 */
import type { TierConflict } from '@banex/utils'

export class TierNotFoundError extends Error {
  constructor(public readonly tierId: string) {
    super(`Nivel "${tierId}" no encontrado.`)
    this.name = 'TierNotFoundError'
  }
}

export class TierValidationFailedError extends Error {
  constructor(public readonly conflicts: TierConflict[]) {
    super(`La configuración de niveles tiene ${conflicts.length} conflictos.`)
    this.name = 'TierValidationFailedError'
  }
}

export class TierInUseError extends Error {
  constructor(public readonly tierId: string, public readonly rebateCount: number) {
    super(
      `El nivel "${tierId}" está referenciado por ${rebateCount} reintegros y no puede eliminarse. Desactívalo en su lugar.`,
    )
    this.name = 'TierInUseError'
  }
}
