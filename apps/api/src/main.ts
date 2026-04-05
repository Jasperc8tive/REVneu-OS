import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { AppModule } from './app.module'

function validateInternalAgentKey(): void {
  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    return
  }

  const key = process.env.AGENT_API_KEY
  const isUnsafe = !key || key.trim().length < 24 || key.toLowerCase().includes('change-me')
  if (isUnsafe) {
    throw new Error('AGENT_API_KEY must be set to a strong non-default value in production')
  }
}

async function bootstrap(): Promise<void> {
  validateInternalAgentKey()

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  })

  // Global prefix — excludes health endpoint for Docker health checks
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  })

  // Trust reverse proxies (nginx/load balancers) for protocol detection.
  const httpApp = app.getHttpAdapter().getInstance()
  httpApp.set('trust proxy', true)

  // Enforce HTTPS for non-local hosts when enabled.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const enforceHttps = (process.env.ENFORCE_HTTPS ?? 'true').toLowerCase() === 'true'
    if (!enforceHttps) {
      return next()
    }

    const host = req.headers.host ?? ''
    const isLocalHost = /(^localhost(:\d+)?$)|(^127\.0\.0\.1(:\d+)?$)/i.test(host)
    if (isLocalHost) {
      return next()
    }

    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
      ?.split(',')[0]
      ?.trim()

    const isSecure = req.secure || forwardedProto === 'https'
    if (isSecure) {
      return next()
    }

    return res.redirect(301, `https://${host}${req.originalUrl}`)
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
