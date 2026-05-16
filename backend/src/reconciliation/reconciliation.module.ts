import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ReconciliationController } from './reconciliation.controller'
import { ReconciliationService } from './reconciliation.service'
import { AnomalyExplainerAgent } from './anomaly-explainer.agent'

@Module({
  imports: [PrismaModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, AnomalyExplainerAgent],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
