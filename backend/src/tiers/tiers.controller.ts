import { Controller, Get, Inject, Query } from '@nestjs/common'
import { TiersService } from './tiers.service'

@Controller('tiers')
export class TiersController {
  constructor(@Inject(TiersService) private readonly tiers: TiersService) {}

  @Get()
  async list(@Query('period') period?: string) {
    return this.tiers.listActive(period)
  }
}
