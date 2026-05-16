import { IsBoolean, IsInt, IsNumberString, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

const DECIMAL_REGEX = /^\d+(\.\d{1,8})?$/
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export class CreateTierDto {
  @IsInt()
  @Min(1)
  level!: number

  @IsString()
  @MaxLength(60)
  name!: string

  @IsNumberString()
  @Matches(DECIMAL_REGEX, { message: 'minAmountBOB debe ser un decimal positivo con hasta 8 decimales' })
  minAmountBOB!: string

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL_REGEX, { message: 'maxAmountBOB debe ser un decimal positivo con hasta 8 decimales' })
  maxAmountBOB?: string | null

  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'rebatePercent debe tener máximo 2 decimales' })
  rebatePercent!: string

  @IsString()
  @Matches(PERIOD_REGEX, { message: 'validFromPeriod debe tener formato YYYY-MM' })
  validFromPeriod!: string

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'validToPeriod debe tener formato YYYY-MM' })
  validToPeriod?: string | null

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
