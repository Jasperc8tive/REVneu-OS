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
  message?: string | string[]
  error?: string
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let error = 'InternalServerError'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'object') {
        const typedResponse = exceptionResponse as HttpExceptionResponse
        message = Array.isArray(typedResponse.message)
          ? typedResponse.message.join(', ')
          : (typedResponse.message ?? exception.message)
        error = typedResponse.error ?? 'HttpException'
      } else {
        message = exceptionResponse as string
      }
    } else if (exception instanceof Error) {
      message = exception.message
      error = exception.name
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.path} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : '',
    )

    // Return standardized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      error,
      message,
    })
  }
}
