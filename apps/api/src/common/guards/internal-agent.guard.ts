import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

@Injectable()
export class InternalAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const incomingKey = request.headers['x-agent-api-key']
    const expectedKey = process.env.AGENT_API_KEY

    if (!expectedKey) {
      throw new UnauthorizedException('AGENT_API_KEY is not configured')
    }

    if (typeof incomingKey !== 'string' || incomingKey !== expectedKey) {
      throw new UnauthorizedException('Invalid internal agent API key')
    }

    return true
  }
}
