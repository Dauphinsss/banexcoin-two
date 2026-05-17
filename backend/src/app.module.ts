import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, Reflector } from '@nestjs/core'
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler'
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
    ThrottlerModule.forRoot({
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest<{ path?: string; url?: string }>()
        return request.path === '/health' || request.url === '/health'
      },
      throttlers: [
        {
          ttl: parsePositiveInt(process.env.THROTTLE_TTL_MS, 60_000),
          limit: parsePositiveInt(process.env.THROTTLE_LIMIT, 100),
        },
      ],
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
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (options: ThrottlerModuleOptions, storage: ThrottlerStorage) =>
        new ThrottlerGuard(options, storage, new Reflector()),
      inject: [getOptionsToken(), getStorageToken()],
    },
  ],
})
export class AppModule {}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
