import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { OrganizationsService } from './organizations.service'
import { OrganizationsController } from './organizations.controller'

@Module({
  imports: [EventEmitterModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
