import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'

@Injectable()
export class RateLimitService {
  private readonly requests: Map<
    string,
    { count: number; resetAt: number }
  > = new Map()

  private readonly RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100 // per minute per tenant

  checkRateLimit(tenantId: string): boolean {
    const now = Date.now()
    const key = tenantId
    const record = this.requests.get(key)

    if (!record || now > record.resetAt) {
      this.requests.set(key, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW,
      })
      return true
    }

    if (record.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false
    }

    record.count++
    return true
  }

  @Cron('*/5 * * * *') // Clean up every 5 minutes
  cleanupExpiredLimits() {
    const now = Date.now()
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetAt) {
        this.requests.delete(key)
      }
    }
  }
}
