import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  DuplicateUploadError,
  InvalidFileError,
  UploadNotFoundError,
} from '../errors/upload.errors'

/**
 * Filter dedicado a los errores de dominio de uploads.
 * Convierte cada error tipado en un response HTTP con shape consistente,
 * sin filtrar detalles internos (stack, paths, etc.).
 */
@Catch(DuplicateUploadError, InvalidFileError, UploadNotFoundError)
export class UploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UploadExceptionFilter.name)

  catch(
    exception: DuplicateUploadError | InvalidFileError | UploadNotFoundError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof DuplicateUploadError) {
      response.status(HttpStatus.CONFLICT).json({
        error: 'DUPLICATE_UPLOAD',
        message: exception.message,
        existingUploadId: exception.existingUploadId,
      })
      return
    }

    if (exception instanceof InvalidFileError) {
      this.logger.warn(`InvalidFile · ${exception.reason}`)
      response.status(HttpStatus.BAD_REQUEST).json({
        error: 'INVALID_FILE',
        message: exception.message,
        reason: exception.reason,
      })
      return
    }

    if (exception instanceof UploadNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        error: 'UPLOAD_NOT_FOUND',
        message: exception.message,
      })
      return
    }
  }
}
