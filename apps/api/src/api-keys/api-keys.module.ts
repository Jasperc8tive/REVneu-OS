import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ApiKeysService } from './api-keys.service'
import { ApiKeysController } from './api-keys.controller'
import { AuthModule } from '../auth/auth.module'
import { ApiKeyGuard } from './api-key.guard'

@Module({
  imports: [EventEmitterModule, AuthModule],
  providers: [ApiKeysService, ApiKeyGuard],
  controllers: [ApiKeysController],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
