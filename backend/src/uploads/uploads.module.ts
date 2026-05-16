import { Module } from '@nestjs/common'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './uploads.service'
import { FileStorageService } from './storage/file-storage.service'
import { ParserModule } from '../parser/parser.module'
import { JobsModule } from '../jobs/jobs.module'
import { TiersModule } from '../tiers/tiers.module'

@Module({
  imports: [ParserModule, JobsModule, TiersModule],
  controllers: [UploadsController],
  providers: [UploadsService, FileStorageService],
  exports: [UploadsService, FileStorageService],
})
export class UploadsModule {}
