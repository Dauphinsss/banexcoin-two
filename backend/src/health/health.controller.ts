import { Controller, Get, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = {
      database: await this.checkDatabase(),
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok')

    return {
      status: allHealthy ? 'ok' : 'degraded',
      service: 'banex-reintegra-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    }
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok' }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'unknown error',
      }
    }
  }
}

interface HealthCheck {
  status: 'ok' | 'error'
  message?: string
}

interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  version: string
  timestamp: string
  checks: Record<string, HealthCheck>
}
