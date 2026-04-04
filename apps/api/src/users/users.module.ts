import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'

@Module({
  imports: [EventEmitterModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
