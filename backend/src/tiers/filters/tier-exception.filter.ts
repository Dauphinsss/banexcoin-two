import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'
import {
  TierInUseError,
  TierNotFoundError,
  TierPeriodLockedError,
  TierPeriodRangeError,
  TierValidationFailedError,
} from '../errors/tier.errors'

@Catch(TierNotFoundError, TierValidationFailedError, TierInUseError, TierPeriodLockedError, TierPeriodRangeError)
export class TierExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TierExceptionFilter.name)

  catch(
    exception:
      | TierNotFoundError
      | TierValidationFailedError
      | TierInUseError
      | TierPeriodLockedError
      | TierPeriodRangeError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof TierNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        error: 'TIER_NOT_FOUND',
        message: exception.message,
      })
      return
    }

    if (exception instanceof TierValidationFailedError) {
      this.logger.warn(`TierValidation falló · conflicts=${exception.conflicts.length}`)
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        error: 'TIER_VALIDATION_FAILED',
        message: exception.message,
        conflicts: exception.conflicts,
      })
      return
    }

    if (exception instanceof TierInUseError) {
      response.status(HttpStatus.CONFLICT).json({
        error: 'TIER_IN_USE',
        message: exception.message,
        rebateCount: exception.rebateCount,
      })
      return
    }

    if (exception instanceof TierPeriodLockedError) {
      response.status(HttpStatus.CONFLICT).json({
        error: 'TIER_PERIOD_LOCKED',
        message: exception.message,
        period: exception.period,
        uploadCount: exception.uploadCount,
      })
      return
    }

    if (exception instanceof TierPeriodRangeError) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        error: 'TIER_PERIOD_RANGE_INVALID',
        message: exception.message,
        validFromPeriod: exception.validFromPeriod,
        validToPeriod: exception.validToPeriod,
      })
    }
  }
}
