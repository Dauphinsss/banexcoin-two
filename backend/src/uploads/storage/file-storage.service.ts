import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

/**
 * Almacenamiento local de los archivos subidos.
 * Los archivos se guardan con nombre = SHA-256 hex + extensión original,
 * dentro de la carpeta `UPLOAD_STORAGE_DIR` (default: ./data/uploads).
 *
 * Decisión: no usamos S3/blob storage en esta etapa porque la ficha técnica
 * exige independencia del core Banexcoin y simplicidad operativa.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name)
  private readonly baseDir: string

  constructor(config: ConfigService) {
    const configured = config.get<string>('UPLOAD_STORAGE_DIR') ?? './data/uploads'
    this.baseDir = resolve(configured)
  }

  async hash(buffer: Buffer): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex')
  }

  async save(fileHash: string, originalName: string, buffer: Buffer): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true })

    const ext = extractExtension(originalName)
    const fullPath = join(this.baseDir, `${fileHash}${ext}`)

    try {
      await fs.access(fullPath)
      this.logger.debug(`Archivo ya en disco · hash=${fileHash.slice(0, 8)}`)
      return fullPath
    } catch {
      // no existe, lo escribimos
    }

    await fs.writeFile(fullPath, buffer)
    this.logger.log(`Archivo persistido · hash=${fileHash.slice(0, 8)} · bytes=${buffer.length}`)
    return fullPath
  }

  async load(fileHash: string, originalName: string): Promise<Buffer> {
    const ext = extractExtension(originalName)
    const fullPath = join(this.baseDir, `${fileHash}${ext}`)
    return fs.readFile(fullPath)
  }

  async exists(fileHash: string, originalName: string): Promise<boolean> {
    const ext = extractExtension(originalName)
    const fullPath = join(this.baseDir, `${fileHash}${ext}`)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }
}

const extractExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) return ''
  return name.slice(lastDot).toLowerCase()
}
