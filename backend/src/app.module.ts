import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { ParserModule } from './parser/parser.module'
import { UploadsModule } from './uploads/uploads.module'
import { TiersModule } from './tiers/tiers.module'
import { JobsModule } from './jobs/jobs.module'
import { ReconciliationModule } from './reconciliation/reconciliation.module'
import { ReportsModule } from './reports/reports.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    HealthModule,
    ParserModule,
    UploadsModule,
    TiersModule,
    JobsModule,
    ReconciliationModule,
    ReportsModule,
  ],
})
export class AppModule {}
