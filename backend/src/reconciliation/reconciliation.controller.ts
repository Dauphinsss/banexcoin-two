import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReconciliationService } from './reconciliation.service'
import { AnomalyExplainerAgent } from './anomaly-explainer.agent'

interface ResolveAnomalyBody {
  note?: string
}

interface ExplainAnomaliesBody {
  uploadId?: string
}

@Controller('reconciliation')
export class ReconciliationController {
  constructor(
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
    @Inject(AnomalyExplainerAgent) private readonly explainer: AnomalyExplainerAgent,
  ) {}

  @Get('stats')
  async stats(@Query('uploadId') uploadId: string) {
    return this.reconciliation.stats(uploadId)
  }

  @Post('explain')
  @HttpCode(200)
  async explain(@Body() body: ExplainAnomaliesBody) {
    if (!body.uploadId) {
      throw new BadRequestException('uploadId es obligatorio.')
    }

    return this.explainer.explain(body.uploadId)
  }

  @Post('explain/stream')
  async explainStream(@Body() body: ExplainAnomaliesBody, @Res() response: Response) {
    if (!body.uploadId) {
      throw new BadRequestException('uploadId es obligatorio.')
    }

    const stream = await this.explainer.explainStream(body.uploadId)

    response.status(200)
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders?.()

    for await (const chunk of stream.chunks) {
      response.write(chunk)
    }

    response.end()
  }

  @Get('anomalies')
  async anomalies(@Query('uploadId') uploadId: string) {
    return this.reconciliation.list(uploadId)
  }

  @Patch('anomalies/:id/resolve')
  async resolve(@Param('id') id: string, @Body() body: ResolveAnomalyBody) {
    return this.reconciliation.resolve(id, body.note)
  }
}
