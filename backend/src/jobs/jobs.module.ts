import { Module } from '@nestjs/common'
import { TiersModule } from '../tiers/tiers.module'
import { ReconcileAgent } from './agents/reconcile.agent'
import { TierAgent } from './agents/tier.agent'

@Module({
  imports: [TiersModule],
  providers: [TierAgent, ReconcileAgent],
  exports: [TierAgent, ReconcileAgent],
})
export class JobsModule {}
