import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common'
import { ReconciliationService } from './reconciliation.service'

interface ResolveAnomalyBody {
  note?: string
}

@Controller('reconciliation')
export class ReconciliationController {
  constructor(@Inject(ReconciliationService) private readonly reconciliation: ReconciliationService) {}

  @Get('stats')
  async stats(@Query('uploadId') uploadId: string) {
    return this.reconciliation.stats(uploadId)
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
