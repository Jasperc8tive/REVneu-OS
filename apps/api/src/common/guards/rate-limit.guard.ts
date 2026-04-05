import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { RateLimitService } from '../services/rate-limit.service'

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimitService: RateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const tenantId = request.user?.organizationId || request.headers['x-api-key']

    // Fall back to client IP so unauthenticated endpoints (login/register) are
    // also protected against brute-force attacks.
    const bucketKey = tenantId ||
      request.ip ||
      request.headers['x-forwarded-for'] ||
      'unknown'

    const allowed = this.rateLimitService.checkRateLimit(bucketKey)
    if (!allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }

    return true
  }
}
