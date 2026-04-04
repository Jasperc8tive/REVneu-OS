import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { JwtPayload } from '../strategies/jwt.strategy'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(error: unknown, user: TUser | false, _info: unknown): TUser {
    if (error || !user) {
      throw error || new UnauthorizedException('Unauthorized')
    }
    return user
  }
}
