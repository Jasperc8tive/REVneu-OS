import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import Redis from 'ioredis'

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name)
  private redisClient: Redis | null = null

  private readonly requests: Map<
    string,
    { count: number; resetAt: number }
  > = new Map()

  private readonly RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100 // per minute per tenant

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim()
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured; falling back to in-memory rate limiting')
      return
    }

    try {
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
      await this.redisClient.connect()
      this.logger.log('Redis-backed rate limiting enabled')
    } catch (error) {
      this.logger.warn('Failed to connect to Redis; falling back to in-memory rate limiting')
      this.redisClient = null
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit()
    }
  }

  async checkRateLimit(bucketId: string): Promise<boolean> {
    if (this.redisClient) {
      try {
        const key = `rate_limit:${bucketId}`
        const count = await this.redisClient.incr(key)

        if (count === 1) {
          await this.redisClient.pexpire(key, this.RATE_LIMIT_WINDOW)
        }

        return count <= this.RATE_LIMIT_MAX_REQUESTS
      } catch {
        this.logger.warn('Redis rate limit check failed; using in-memory fallback')
      }
    }

    return this.checkRateLimitInMemory(bucketId)
  }

  private checkRateLimitInMemory(bucketId: string): boolean {
    const now = Date.now()
    const key = bucketId
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
