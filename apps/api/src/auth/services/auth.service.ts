import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '@revneu/database'
import { CryptoService } from './crypto.service'
import { JwtService } from './jwt.service'

export interface RegisterDto {
  email: string
  password: string
  name: string
  organizationName: string
  organizationSlug: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface RefreshTokenDto {
  refreshToken: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: string
    organizationId: string
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly tokenService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existingUser) {
      throw new BadRequestException('Email already registered')
    }

    // Check if organization slug is available
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    })
    if (existingOrg) {
      throw new BadRequestException('Organization slug already exists')
    }

    // Create organization (tenant)
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug: dto.organizationSlug,
      },
    })

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: this.cryptoService.hashPassword(dto.password),
        role: 'OWNER', // First user is owner
        organizationId: organization.id,
      },
    })

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        refreshTokenHash: '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
      },
    })

    const refreshToken = this.tokenService.createRefreshToken({
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      sessionId: session.id,
    })

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.cryptoService.hashToken(refreshToken),
      },
    })

    // Emit audit event
    this.eventEmitter.emit('audit', {
      organizationId: organization.id,
      userId: user.id,
      action: 'user.registered',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
    })

    const accessToken = this.tokenService.createAccessToken({
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: user.role,
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        role: user.role,
        organizationId: organization.id,
      },
    }
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    })

    if (!user || !this.cryptoService.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password')
    }

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        refreshTokenHash: '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
      },
    })

    const refreshToken = this.tokenService.createRefreshToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      sessionId: session.id,
    })

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.cryptoService.hashToken(refreshToken),
      },
    })

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Emit audit event
    this.eventEmitter.emit('audit', {
      organizationId: user.organizationId,
      userId: user.id,
      action: 'user.login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
    })

    const accessToken = this.tokenService.createAccessToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    }
  }

  async refreshToken(
    dto: RefreshTokenDto,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    let payload

    try {
      payload = this.tokenService.verifyRefreshToken(dto.refreshToken)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Find session
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    })

    if (!session || session.isRevoked || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or revoked')
    }

    // Verify token hash
    const tokenHash = this.cryptoService.hashToken(dto.refreshToken)
    if (tokenHash !== session.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // Create new tokens
    const newAccessToken = this.tokenService.createAccessToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    })

    const newRefreshToken = this.tokenService.createRefreshToken({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      sessionId: session.id,
    })

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.cryptoService.hashToken(newRefreshToken),
      },
    })

    this.eventEmitter.emit('audit', {
      organizationId: user.organizationId,
      userId: user.id,
      action: 'token.refreshed',
      resourceType: 'session',
      resourceId: session.id,
      ipAddress,
    })

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    })
  }
}
