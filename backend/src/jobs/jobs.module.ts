import { Module } from '@nestjs/common'
import { TiersModule } from '../tiers/tiers.module'
import { TierAgent } from './agents/tier.agent'

@Module({
  imports: [TiersModule],
  providers: [TierAgent],
  exports: [TierAgent],
})
export class JobsModule {}
