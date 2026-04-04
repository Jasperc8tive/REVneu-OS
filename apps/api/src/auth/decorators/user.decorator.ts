import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { JwtPayload } from '../strategies/jwt.strategy'

export const User = createParamDecorator<
  keyof JwtPayload | undefined,
  ExecutionContext
>((data, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user: JwtPayload = request.user

  return data ? user?.[data] : user
})

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  return request.user?.organizationId
})
