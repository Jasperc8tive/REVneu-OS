import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { PrismaService } from '@revneu/database'
import { CryptoService } from '../auth/services/crypto.service'

/**
 * Guard that authenticates requests using a raw API key passed in the
 * `x-api-key` request header.  On success it sets `request.user` to a
 * minimal JwtPayload-compatible object so downstream guards and decorators
 * (e.g. @TenantId(), RateLimitGuard) work transparently.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const rawKey = request.headers['x-api-key']

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing API key')
    }

    const keyHash = this.cryptoService.hashToken(rawKey)

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    })

    if (
      !apiKey ||
      !apiKey.isActive ||
      (apiKey.expiresAt && apiKey.expiresAt < new Date())
    ) {
      throw new UnauthorizedException('Invalid or expired API key')
    }

    // Record last usage (fire-and-forget – do not block the request)
    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    // Attach a synthetic user so @TenantId(), RolesGuard etc. work normally.
    // API keys run with ADMIN-level access within their tenant.
    ;(request as Request & { user: unknown }).user = {
      sub: apiKey.id,
      email: 'api-key@internal',
      organizationId: apiKey.organizationId,
      role: 'ADMIN',
    }

    return true
  }
}
