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

export class TierPeriodLockedError extends Error {
  constructor(
    public readonly period: string,
    public readonly uploadCount: number,
  ) {
    super(
      `No se puede publicar una configuraciÃ³n desde ${period} porque existen ${uploadCount} uploads procesados desde ese perÃ­odo.`,
    )
    this.name = 'TierPeriodLockedError'
  }
}

export class TierPeriodRangeError extends Error {
  constructor(
    public readonly validFromPeriod: string,
    public readonly validToPeriod: string,
  ) {
    super(`El periodo final ${validToPeriod} no puede ser anterior al periodo inicial ${validFromPeriod}.`)
    this.name = 'TierPeriodRangeError'
  }
}
