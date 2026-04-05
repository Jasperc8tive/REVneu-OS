import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { randomUUID } from 'crypto'
import { Observable } from 'rxjs'
import { map, tap } from 'rxjs/operators'

export interface ApiResponse<T> {
  status: 'success' | 'error'
  data?: T
  message?: string
  timestamp: string
}

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  private apiUsageTablesReady = false

  constructor(private readonly prisma: PrismaService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<{
      method?: string
      url?: string
      originalUrl?: string
      user?: { organizationId?: string }
    }>()

    const response = context.switchToHttp().getResponse<{ statusCode?: number }>()

    return next.handle().pipe(
      tap({
        next: () => {
          void this.recordApiUsage(request, response.statusCode ?? 200)
        },
        error: () => {
          void this.recordApiUsage(request, response.statusCode ?? 500)
        },
      }),
      map((data) => ({
        status: 'success',
        data: data || null,
        timestamp: new Date().toISOString(),
      })),
    )
  }

  private async recordApiUsage(
    request: {
      method?: string
      url?: string
      originalUrl?: string
      user?: { organizationId?: string }
    },
    statusCode: number,
  ): Promise<void> {
    const organizationId = request.user?.organizationId
    if (!organizationId) {
      return
    }

    const path = request.originalUrl ?? request.url ?? 'unknown'
    const method = request.method ?? 'GET'

    try {
      await this.ensureApiUsageTable()
      await this.prisma.$executeRaw`
        INSERT INTO api_usage_events (
          id,
          organization_id,
          method,
          path,
          status_code,
          created_at
        ) VALUES (
          ${randomUUID()},
          ${organizationId},
          ${method},
          ${path},
          ${statusCode},
          NOW()
        )
      `
    } catch {
      // Usage metering must never block API responses.
    }
  }

  private async ensureApiUsageTable(): Promise<void> {
    if (this.apiUsageTablesReady) {
      return
    }

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS api_usage_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_api_usage_events_org_created_at
      ON api_usage_events (organization_id, created_at DESC)
    `

    this.apiUsageTablesReady = true
  }
}
