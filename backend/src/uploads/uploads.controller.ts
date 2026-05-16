import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'
import { memoryStorage } from 'multer'
import { CreateUploadDto } from './dto/create-upload.dto'
import { UploadsService } from './uploads.service'
import { UploadExceptionFilter } from './filters/upload-exception.filter'

@Controller('uploads')
@UseFilters(UploadExceptionFilter)
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    config: ConfigService,
  ) {
    this.maxBytes = Number(config.get<string>('MAX_UPLOAD_SIZE_MB') ?? '50') * 1024 * 1024
  }

  private readonly maxBytes: number

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        // Aplicamos límite en multer y volvemos a validar en el service
        // para tener mensajes en español controlados.
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateUploadDto,
  ) {
    return this.uploads.create(file, body.period)
  }

  @Get()
  async list() {
    return this.uploads.list()
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.uploads.findById(id)
  }
}
