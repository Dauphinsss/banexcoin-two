import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { TierInUseError, TierNotFoundError, TierValidationFailedError } from '../errors/tier.errors'

@Catch(TierNotFoundError, TierValidationFailedError, TierInUseError)
export class TierExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TierExceptionFilter.name)

  catch(
    exception: TierNotFoundError | TierValidationFailedError | TierInUseError,
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
    }
  }
}
