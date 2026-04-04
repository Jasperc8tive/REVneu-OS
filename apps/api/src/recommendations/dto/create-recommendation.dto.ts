import { IsArray, IsOptional, IsString } from 'class-validator'

export class CreateRecommendationDto {
  @IsString()
  organizationId!: string

  @IsString()
  agentRunId!: string

  @IsString()
  agentId!: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsArray()
  findings!: Record<string, unknown>[]
}