import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator'
import type { IntegrationAuthType, IntegrationSource } from '@revneu/database'

export class CreateIntegrationDto {
  @IsEnum([
    'GA4',
    'META_ADS',
    'GOOGLE_ADS',
    'HUBSPOT',
    'PAYSTACK',
    'STRIPE',
    'SHOPIFY',
    'FLUTTERWAVE',
    'TIKTOK_ADS',
    'SALESFORCE',
  ])
  source!: IntegrationSource

  @IsEnum(['OAUTH', 'API_KEY', 'WEBHOOK'])
  authType!: IntegrationAuthType

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string

  @IsObject()
  credentials!: Record<string, unknown>

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  syncIntervalMinutes?: number
}
