import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { EventEmitter2 } from '@nestjs/event-emitter'

type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

export interface InviteUserDto {
  email: string
  role: UserRole // VIEWER, ANALYST, ADMIN, OWNER
  name?: string
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getTeamMembers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  async updateUser(
    userId: string,
    organizationId: string,
    updates: { name?: string; role?: UserRole },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.organizationId !== organizationId) {
      throw new NotFoundException('User not found in this organization')
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
      },
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId,
      action: 'user.updated',
      resourceType: 'user',
      resourceId: userId,
      changes: updates,
    })

    return updated
  }

  async removeUser(
    userIdToRemove: string,
    organizationId: string,
    requestingUserId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userIdToRemove },
    })

    if (!user || user.organizationId !== organizationId) {
      throw new NotFoundException('User not found in this organization')
    }

    if (user.role === 'OWNER') {
      throw new BadRequestException('Cannot remove owner')
    }

    await this.prisma.user.delete({
      where: { id: userIdToRemove },
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId: requestingUserId,
      action: 'user.removed',
      resourceType: 'user',
      resourceId: userIdToRemove,
    })
  }
}
