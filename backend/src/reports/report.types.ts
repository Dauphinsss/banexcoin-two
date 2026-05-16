/**
 * Tipos compartidos del módulo de reportes.
 * Cada generador devuelve un `ReportFile` listo para ser servido por HTTP.
 */
export interface ReportFile {
  filename: string
  mimeType: string
  buffer: Buffer
}
