import { IsBoolean, IsInt, IsNumberString, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

const DECIMAL_REGEX = /^\d+(\.\d{1,8})?$/
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export class UpdateTierDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL_REGEX)
  minAmountBOB?: string

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL_REGEX)
  maxAmountBOB?: string | null

  @IsOptional()
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  rebatePercent?: string

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  validFromPeriod?: string

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  validToPeriod?: string | null

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
