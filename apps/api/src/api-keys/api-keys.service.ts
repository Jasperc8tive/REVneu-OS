import { EventEmitter2 } from '@nestjs/event-emitter'
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { CryptoService } from '../auth/services/crypto.service'

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createApiKey(
    organizationId: string,
    userId: string,
    name: string,
  ) {
    const plainToken = `revneu_${this.cryptoService.generateToken(24)}`
    const keyHash = this.cryptoService.hashToken(plainToken)

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        keyHash,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId,
      action: 'apikey.created',
      resourceType: 'api_key',
      resourceId: apiKey.id,
    })

    return {
      id: apiKey.id,
      name: apiKey.name,
      token: plainToken, // Only return once
      createdAt: apiKey.createdAt,
    }
  }

  async listApiKeys(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async revokeApiKey(organizationId: string, apiKeyId: string, userId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    })

    if (!apiKey || apiKey.organizationId !== organizationId) {
      throw new NotFoundException('API key not found')
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId,
      action: 'apikey.revoked',
      resourceType: 'api_key',
      resourceId: apiKeyId,
    })
  }

  async verifyApiKey(token: string) {
    const keyHash = this.cryptoService.hashToken(token)

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    })

    if (!apiKey || !apiKey.isActive || (apiKey.expiresAt && new Date() > apiKey.expiresAt)) {
      return null
    }

    // Update last used
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    return apiKey.organizationId
  }
}
