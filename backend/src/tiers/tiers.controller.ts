import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common'
import { TiersService } from './tiers.service'
import { CreateTierDto } from './dto/create-tier.dto'
import { PublishTierConfigDto } from './dto/publish-tier-config.dto'
import { UpdateTierDto } from './dto/update-tier.dto'
import { ValidateTiersDto } from './dto/validate-tiers.dto'
import { TierExceptionFilter } from './filters/tier-exception.filter'

@Controller('tiers')
@UseFilters(TierExceptionFilter)
export class TiersController {
  constructor(@Inject(TiersService) private readonly tiers: TiersService) {}

  @Get()
  async list(@Query('period') period?: string) {
    return this.tiers.listActive(period)
  }

  @Get('history')
  async history() {
    return this.tiers.listAll()
  }

  @Post()
  async create(@Body() dto: CreateTierDto) {
    return this.tiers.create(dto)
  }

  @Post('validate')
  validate(@Body() dto: ValidateTiersDto) {
    return this.tiers.validateOnly(dto)
  }

  @Post('publish')
  async publish(@Body() dto: PublishTierConfigDto) {
    return this.tiers.publishConfiguration(dto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTierDto) {
    return this.tiers.update(id, dto)
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.tiers.deactivate(id)
  }
}
