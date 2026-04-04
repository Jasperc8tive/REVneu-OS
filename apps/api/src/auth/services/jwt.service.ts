import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService as NestJwtService } from '@nestjs/jwt'

export interface AccessTokenPayload {
  sub: string
  email: string
  organizationId: string
  role: string
}

export interface RefreshTokenPayload {
  sub: string
  email: string
  organizationId: string
  sessionId: string
}

@Injectable()
export class JwtService {
  constructor(
    private jwtService: NestJwtService,
    private configService: ConfigService,
  ) {}

  createAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    })
  }

  createRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    })
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    })
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    })
  }
}
