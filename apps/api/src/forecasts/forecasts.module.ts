import { Module } from '@nestjs/common'
import { MetricsModule } from '../metrics/metrics.module'
import { ForecastsController } from './forecasts.controller'
import { ForecastsService } from './forecasts.service'

@Module({
  imports: [MetricsModule],
  controllers: [ForecastsController],
  providers: [ForecastsService],
})
export class ForecastsModule {}
