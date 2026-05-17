import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator'

const DECIMAL_REGEX = /^\d+(\.\d{1,8})?$/
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export class PublishTierInputDto {
  @IsInt()
  @Min(1)
  level!: number

  @IsString()
  name!: string

  @IsNumberString()
  @Matches(DECIMAL_REGEX)
  minAmountBOB!: string

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL_REGEX)
  maxAmountBOB?: string | null

  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  rebatePercent!: string
}

export class PublishTierConfigDto {
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'validFromPeriod debe tener formato YYYY-MM' })
  validFromPeriod!: string

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'validToPeriod debe tener formato YYYY-MM' })
  validToPeriod?: string | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishTierInputDto)
  tiers!: PublishTierInputDto[]
}
