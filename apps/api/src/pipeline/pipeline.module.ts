import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module'
import { ConnectorsModule } from '../connectors/connectors.module'
import { MetricsModule } from '../metrics/metrics.module'
import { PipelineService } from './pipeline.service'

@Module({
  imports: [CommonModule, ConnectorsModule, MetricsModule],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
