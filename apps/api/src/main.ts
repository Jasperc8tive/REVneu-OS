import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  })

  // Global prefix — excludes health endpoint for Docker health checks
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  })

  // Strict input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // CORS — locked to allowed frontend origin
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  const port = parseInt(process.env.PORT ?? '4000', 10)
  await app.listen(port)
  console.log(`[Revneu API] Running on port ${port} — http://localhost:${port}`)
}

bootstrap()
