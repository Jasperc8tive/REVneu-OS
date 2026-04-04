import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ApiKeysService } from './api-keys.service'
import { ApiKeysController } from './api-keys.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [EventEmitterModule, AuthModule],
  providers: [ApiKeysService],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
