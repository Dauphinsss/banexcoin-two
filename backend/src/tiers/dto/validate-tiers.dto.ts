import { Type } from 'class-transformer'
import { IsArray, IsInt, IsNumberString, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator'

const DECIMAL_REGEX = /^\d+(\.\d{1,8})?$/

export class TierInputDto {
  @IsOptional()
  @IsString()
  id?: string

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

export class ValidateTiersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierInputDto)
  tiers!: TierInputDto[]
}
