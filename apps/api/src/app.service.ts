import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHealth(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      service: 'revneu-api',
      timestamp: new Date().toISOString(),
    }
  }
}
