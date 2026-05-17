import {
  Body,
  Controller,
  Get,
  Inject,
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
    @Inject(UploadsService)
    private readonly uploads: UploadsService,
    @Inject(ConfigService)
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
    const allowDuplicate = body.allowDuplicate === 'true' || body.allowDuplicate === '1'
    return this.uploads.create(file, body.period, allowDuplicate)
  }

  @Get()
  async list() {
    return this.uploads.list()
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.uploads.findById(id)
  }

  @Get(':id/rebates')
  async rebates(@Param('id') id: string) {
    return this.uploads.listRebates(id)
  }

  @Get(':id/transactions-minimal')
  async transactionsMinimal(@Param('id') id: string) {
    return this.uploads.listMinimalTransactions(id)
  }

  @Get(':id/users/:accountNumber/transactions')
  async userTransactions(
    @Param('id') id: string,
    @Param('accountNumber') accountNumber: string,
  ) {
    return this.uploads.listUserTransactions(id, accountNumber)
  }
}
