import { IsInt, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'

export class CreateAgentRunDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  organizationId!: string

  @IsString()
  agentId!: string

  @IsString()
  period!: string

  @IsString()
  status!: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'

  @IsOptional()
  @IsString()
  startedAt?: string

  @IsOptional()
  @IsString()
  finishedAt?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  tokensUsed?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  tokenCostUsd?: number

  @IsOptional()
  @IsString()
  error?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}