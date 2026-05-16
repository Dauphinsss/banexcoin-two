/**
 * Errores de dominio del módulo de uploads.
 *
 * Cada uno se convierte a HTTP en `upload-exception.filter.ts`. Nunca se
 * lanzan HttpException directos desde el service — la conversión vive en
 * la capa de presentación (ver CONVENTIONS.md sección 5).
 */

export class DuplicateUploadError extends Error {
  constructor(public readonly existingUploadId: string) {
    super('El archivo ya fue procesado anteriormente.')
    this.name = 'DuplicateUploadError'
  }
}

export class InvalidFileError extends Error {
  constructor(public readonly reason: string, message?: string) {
    super(message ?? `Archivo inválido: ${reason}`)
    this.name = 'InvalidFileError'
  }
}

export class UploadNotFoundError extends Error {
  constructor(public readonly uploadId: string) {
    super(`Upload "${uploadId}" no encontrado.`)
    this.name = 'UploadNotFoundError'
  }
}
