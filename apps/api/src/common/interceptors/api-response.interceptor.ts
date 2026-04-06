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
  constructor(private readonly prisma: PrismaService) {}

  private get prismaExt(): PrismaService & {
    apiUsageEvent: {
      create: (args: unknown) => Promise<unknown>
    }
  } {
    return this.prisma as PrismaService & {
      apiUsageEvent: {
        create: (args: unknown) => Promise<unknown>
      }
    }
  }

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
      await this.prismaExt.apiUsageEvent.create({
        data: {
          id: randomUUID(),
          organizationId,
          method,
          path,
          statusCode,
        },
      })
    } catch {
      // Usage metering must never block API responses.
    }
  }
}
