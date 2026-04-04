import { OnEvent } from '@nestjs/event-emitter'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'

export interface AuditEventPayload {
  organizationId: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  changes?: Record<string, unknown> | null
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  @OnEvent('audit')
  async handleAuditEvent(payload: AuditEventPayload) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: payload.userId,
          action: payload.action,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          changes: payload.changes as unknown as object,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
      // Don't throw - audit failures shouldn't block business logic
    }
  }

  async getAuditLogs(organizationId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
