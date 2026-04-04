import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { Request } from 'express'
import { Strategy } from 'passport-jwt'

export interface JwtPayload {
  sub: string // userId
  email: string
  organizationId: string
  role: string
  iat?: number
  exp?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request | undefined) => {
        const token = req?.headers?.authorization?.replace('Bearer ', '')
        if (!token) return null
        return token
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload
  }
}
