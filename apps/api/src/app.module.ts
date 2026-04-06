import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { DatabaseModule } from '@revneu/database'
import { ApiKeysModule } from './api-keys/api-keys.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { RateLimitGuard } from './common/guards/rate-limit.guard'
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor'
import { ConnectorsModule } from './connectors/connectors.module'
import { BillingModule } from './billing/billing.module'
import { ForecastsModule } from './forecasts/forecasts.module'
import { IntegrationsModule } from './integrations/integrations.module'
import { MetricsModule } from './metrics/metrics.module'
import { OnboardingModule } from './onboarding/onboarding.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { PipelineModule } from './pipeline/pipeline.module'
import { AgentRunsModule } from './agent-runs/agent-runs.module'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { UsersModule } from './users/users.module'
import { WorkersModule } from './workers/workers.module'

function getRedisConnectionConfig(): { host: string; port: number } {
  const redisUrl = process.env.REDIS_URL?.trim()

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl)
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      }
    } catch {
      // Fall back to explicit host/port values if REDIS_URL is malformed.
    }
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    BullModule.forRoot({
      connection: getRedisConnectionConfig(),
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    CommonModule,
    OrganizationsModule,
    UsersModule,
    ApiKeysModule,
    IntegrationsModule,
    ConnectorsModule,
    BillingModule,
    ForecastsModule,
    MetricsModule,
    OnboardingModule,
    PipelineModule,
    AgentRunsModule,
    RecommendationsModule,
    WorkersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
