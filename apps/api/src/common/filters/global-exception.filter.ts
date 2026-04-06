import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

type HttpExceptionResponse = {
  code?: string
  message?: string | string[]
  error?: string
  details?: unknown
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter')

  private normalizeCode(input: string): string {
    return input
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase() || 'INTERNAL_SERVER_ERROR'
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let code = 'INTERNAL_SERVER_ERROR'
    let details: unknown = null

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'object') {
        const typedResponse = exceptionResponse as HttpExceptionResponse
        if (Array.isArray(typedResponse.message)) {
          message = typedResponse.message[0] ?? exception.message
          details = { validationErrors: typedResponse.message }
        } else {
          message = typedResponse.message ?? exception.message
          details = typedResponse.details ?? null
        }

        const fallbackCode = typedResponse.error ?? 'HttpException'
        code = this.normalizeCode(typedResponse.code ?? fallbackCode)
      } else {
        message = exceptionResponse as string
        code = this.normalizeCode(exception.name)
      }
    } else if (exception instanceof Error) {
      message = exception.message
      code = this.normalizeCode(exception.name)
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.path} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : '',
    )

    // Return standardized error response
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.path,
    })
  }
}
