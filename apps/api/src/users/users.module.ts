import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuthModule } from '../auth/auth.module'
import { BillingModule } from '../billing/billing.module'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'

@Module({
  imports: [EventEmitterModule, AuthModule, BillingModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
