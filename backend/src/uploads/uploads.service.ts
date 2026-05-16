import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CreateUploadResponse, UploadSummary } from '@banex/types'
import { PrismaService } from '../prisma/prisma.service'
import { FileStorageService } from './storage/file-storage.service'
import {
  DuplicateUploadError,
  InvalidFileError,
  UploadNotFoundError,
} from './errors/upload.errors'

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls'])

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  private readonly maxBytes: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    config: ConfigService,
  ) {
    const maxMb = Number(config.get<string>('MAX_UPLOAD_SIZE_MB') ?? '50')
    this.maxBytes = maxMb * 1024 * 1024
  }

  async create(
    file: Express.Multer.File,
    period: string | undefined,
  ): Promise<CreateUploadResponse> {
    this.validateFile(file)

    const fileHash = await this.storage.hash(file.buffer)

    const existing = await this.prisma.upload.findUnique({
      where: { fileHash },
    })

    if (existing) {
      this.logger.log(
        `Upload duplicado detectado · hash=${fileHash.slice(0, 8)} · existingId=${existing.id}`,
      )
      throw new DuplicateUploadError(existing.id)
    }

    await this.storage.save(fileHash, file.originalname, file.buffer)

    const upload = await this.prisma.upload.create({
      data: {
        filename: file.originalname,
        fileHash,
        fileSizeBytes: file.size,
        period: period ?? null,
        status: 'PENDING',
        rowCount: 0,
      },
      select: { id: true, status: true },
    })

    this.logger.log(
      `Upload aceptado · id=${upload.id} · hash=${fileHash.slice(0, 8)} · bytes=${file.size}`,
    )

    return {
      uploadId: upload.id,
      status: upload.status,
      wasDuplicate: false,
    }
  }

  async findById(uploadId: string): Promise<UploadSummary> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        _count: {
          select: {
            rebates: true,
            anomalies: true,
            parseErrors: true,
          },
        },
      },
    })

    if (!upload) throw new UploadNotFoundError(uploadId)

    return {
      id: upload.id,
      filename: upload.filename,
      fileHash: upload.fileHash,
      period: upload.period,
      status: upload.status,
      rowCount: upload.rowCount,
      rebateCount: upload._count.rebates,
      anomalyCount: upload._count.anomalies,
      parseErrorCount: upload._count.parseErrors,
      createdAt: upload.createdAt.toISOString(),
      errorMessage: upload.errorMessage,
    }
  }

  async list(): Promise<UploadSummary[]> {
    const uploads = await this.prisma.upload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: {
          select: {
            rebates: true,
            anomalies: true,
            parseErrors: true,
          },
        },
      },
    })

    return uploads.map((upload) => ({
      id: upload.id,
      filename: upload.filename,
      fileHash: upload.fileHash,
      period: upload.period,
      status: upload.status,
      rowCount: upload.rowCount,
      rebateCount: upload._count.rebates,
      anomalyCount: upload._count.anomalies,
      parseErrorCount: upload._count.parseErrors,
      createdAt: upload.createdAt.toISOString(),
      errorMessage: upload.errorMessage,
    }))
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new InvalidFileError('NO_FILE', 'No se recibió ningún archivo.')
    }

    if (file.size === 0) {
      throw new InvalidFileError('EMPTY_FILE', 'El archivo está vacío.')
    }

    if (file.size > this.maxBytes) {
      throw new InvalidFileError(
        'FILE_TOO_LARGE',
        `El archivo supera el límite de ${this.maxBytes / 1024 / 1024} MB.`,
      )
    }

    const extension = extractExtension(file.originalname)
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new InvalidFileError(
        'INVALID_EXTENSION',
        `Extensión "${extension}" no permitida. Se aceptan: ${[...ALLOWED_EXTENSIONS].join(', ')}.`,
      )
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new InvalidFileError(
        'INVALID_MIME',
        `Tipo de archivo no permitido. Asegúrate de subir un Excel (.xlsx).`,
      )
    }
  }
}

const extractExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) return ''
  return name.slice(lastDot).toLowerCase()
}
