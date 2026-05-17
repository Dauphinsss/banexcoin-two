import { IsIn, IsOptional, IsString, Matches } from 'class-validator'

/**
 * Campos opcionales que pueden acompañar al multipart.
 * El archivo en sí no viene como DTO sino como `Express.Multer.File`.
 */
export class CreateUploadDto {
  /** Override manual del período si la detección automática falla o el usuario quiere forzar uno. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period debe tener formato YYYY-MM',
  })
  period?: string

  /** Confirmacion explicita para reprocesar un archivo duplicado en modo test. */
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false', '1', '0'])
  allowDuplicate?: string
}
