import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { EventEmitter2 } from '@nestjs/event-emitter'

type Industry =
  | 'FINTECH'
  | 'ECOMMERCE'
  | 'EDTECH'
  | 'LOGISTICS'
  | 'SAAS'
  | 'MARKETING_AGENCY'
  | 'OTHER'

export interface UpdateOrganizationDto {
  name?: string
  industry?: Industry
  country?: string
  currency?: string
  timezone?: string
}

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    })

    if (!org) {
      throw new NotFoundException('Organization not found')
    }

    return org
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    // Verify user is OWNER
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (user?.role !== 'OWNER') {
      throw new BadRequestException('Only owners can update organization')
    }

    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId,
      action: 'organization.updated',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: dto,
    })

    return org
  }
}
