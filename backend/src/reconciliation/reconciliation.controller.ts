import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common'
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

  @Get('anomalies')
  async anomalies(@Query('uploadId') uploadId: string) {
    return this.reconciliation.list(uploadId)
  }

  @Patch('anomalies/:id/resolve')
  async resolve(@Param('id') id: string, @Body() body: ResolveAnomalyBody) {
    return this.reconciliation.resolve(id, body.note)
  }
}
