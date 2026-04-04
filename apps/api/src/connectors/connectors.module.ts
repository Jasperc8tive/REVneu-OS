import { Module } from '@nestjs/common'
import { ConnectorsService } from './connectors.service'

@Module({
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
