import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { promises as fs } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'

/**
 * Almacenamiento de uploads configurable.
 * - `FILE_STORAGE_DRIVER=local`  -> disco local en `UPLOAD_STORAGE_DIR`
 * - `FILE_STORAGE_DRIVER=s3`     -> bucket S3 en `S3_BUCKET`
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name)
  private readonly baseDir: string
  private readonly driver: 'local' | 's3'
  private readonly s3Bucket: string | null
  private readonly s3Prefix: string
  private readonly s3Client: S3Client | null

  constructor(@Inject(ConfigService) config: ConfigService) {
    const configured = config.get<string>('UPLOAD_STORAGE_DIR') ?? './data/uploads'
    this.baseDir = resolve(configured)
    this.driver = parseStorageDriver(config.get<string>('FILE_STORAGE_DRIVER'))
    this.s3Bucket = config.get<string>('S3_BUCKET')?.trim() || null
    this.s3Prefix = trimSlashes(config.get<string>('S3_PREFIX') ?? 'uploads')

    if (this.driver === 's3') {
      if (!this.s3Bucket) {
        throw new Error('S3_BUCKET es obligatorio cuando FILE_STORAGE_DRIVER=s3.')
      }

      this.s3Client = new S3Client({
        region: config.get<string>('S3_REGION') || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
        endpoint: config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: parseBooleanConfig(config.get<string>('S3_FORCE_PATH_STYLE'), false),
      })
      return
    }

    this.s3Client = null
  }

  async hash(buffer: Buffer): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex')
  }

  async save(fileHash: string, originalName: string, buffer: Buffer): Promise<string> {
    if (this.driver === 's3') {
      return this.saveToS3(fileHash, originalName, buffer)
    }

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
    if (this.driver === 's3') {
      return this.loadFromS3(fileHash, originalName)
    }

    const ext = extractExtension(originalName)
    const fullPath = join(this.baseDir, `${fileHash}${ext}`)
    return fs.readFile(fullPath)
  }

  async exists(fileHash: string, originalName: string): Promise<boolean> {
    if (this.driver === 's3') {
      return this.existsInS3(fileHash, originalName)
    }

    const ext = extractExtension(originalName)
    const fullPath = join(this.baseDir, `${fileHash}${ext}`)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
      }
  }

  private async saveToS3(fileHash: string, originalName: string, buffer: Buffer): Promise<string> {
    const key = this.buildS3Key(fileHash, originalName)

    if (await this.existsInS3(fileHash, originalName)) {
      this.logger.debug(`Archivo ya en S3 · hash=${fileHash.slice(0, 8)}`)
      return `s3://${this.s3Bucket}/${key}`
    }

    await this.s3Client!.send(new PutObjectCommand({
      Bucket: this.s3Bucket!,
      Key: key,
      Body: buffer,
      ContentType: inferContentType(originalName),
    }))

    this.logger.log(`Archivo persistido en S3 · hash=${fileHash.slice(0, 8)} · bytes=${buffer.length}`)
    return `s3://${this.s3Bucket}/${key}`
  }

  private async loadFromS3(fileHash: string, originalName: string): Promise<Buffer> {
    const key = this.buildS3Key(fileHash, originalName)
    const response = await this.s3Client!.send(new GetObjectCommand({
      Bucket: this.s3Bucket!,
      Key: key,
    }))

    return readBodyAsBuffer(response.Body)
  }

  private async existsInS3(fileHash: string, originalName: string): Promise<boolean> {
    const key = this.buildS3Key(fileHash, originalName)

    try {
      await this.s3Client!.send(new HeadObjectCommand({
        Bucket: this.s3Bucket!,
        Key: key,
      }))
      return true
    } catch (error) {
      if (isS3NotFoundError(error)) {
        return false
      }

      throw error
    }
  }

  private buildS3Key(fileHash: string, originalName: string): string {
    const ext = extractExtension(originalName)
    return this.s3Prefix ? `${this.s3Prefix}/${fileHash}${ext}` : `${fileHash}${ext}`
  }
}

const extractExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) return ''
  return name.slice(lastDot).toLowerCase()
}

const inferContentType = (name: string): string => {
  const extension = extractExtension(name)
  if (extension === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (extension === '.xls') return 'application/vnd.ms-excel'
  return 'application/octet-stream'
}

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const parseStorageDriver = (value: string | undefined): 'local' | 's3' =>
  value?.trim().toLowerCase() === 's3' ? 's3' : 'local'

const parseBooleanConfig = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const readBodyAsBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    return Buffer.from(bytes)
  }

  throw new Error('No se pudo leer el cuerpo devuelto por S3.')
}

const isS3NotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const details = error as Error & {
    name?: string
    Code?: string
    $metadata?: { httpStatusCode?: number }
  }

  return (
    details.name === 'NotFound' ||
    details.Code === 'NotFound' ||
    details.Code === 'NoSuchKey' ||
    details.$metadata?.httpStatusCode === 404
  )
}
