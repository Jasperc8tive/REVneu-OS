import { IsEmail, IsIn, IsOptional, IsString, IsUrl } from 'class-validator'

export class CreateCheckoutDto {
  @IsString()
  @IsIn(['starter', 'growth', 'scale'])
  planId!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  @IsIn(['NGN', 'USD'])
  currency?: 'NGN' | 'USD'

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string
}
