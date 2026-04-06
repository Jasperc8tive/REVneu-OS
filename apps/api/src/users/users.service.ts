import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomBytes } from 'crypto'
import { CryptoService } from '../auth/services/crypto.service'
import { BillingService } from '../billing/billing.service'
import { InviteUserDto } from './dto/invite-user.dto'

type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private cryptoService: CryptoService,
    private billingService: BillingService,
  ) {}

  async inviteUser(organizationId: string, requestingUserId: string, dto: InviteUserDto) {
    await this.billingService.assertWithinLimit(organizationId, 'users')

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new BadRequestException('User with this email already exists')
    }

    const temporaryPassword = randomBytes(18).toString('hex')

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        organizationId,
        passwordHash: await this.cryptoService.hashPassword(temporaryPassword),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      userId: requestingUserId,
      action: 'user.invited',
      resourceType: 'user',
      resourceId: user.id,
      changes: {
        email: dto.email,
        role: dto.role,
      },
    })

    return {
      ...user,
      temporaryPassword,
      message: 'Invite created. Share temporary password securely and force reset on first login.',
    }
  }

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
