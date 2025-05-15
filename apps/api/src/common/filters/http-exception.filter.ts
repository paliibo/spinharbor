import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@spinharbor/database';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { DomainError } from '../errors/domain.errors';

/** Centralised error handling: every error becomes a consistent JSON envelope. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { statusCode: status, error: 'Internal Server Error', message: 'Unexpected error' };

    if (exception instanceof DomainError) {
      status = exception.status;
      body = { statusCode: status, error: HttpStatus[status], code: exception.code, message: exception.message, details: exception.details };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = typeof resp === 'string' ? { statusCode: status, error: HttpStatus[status], message: resp } : { statusCode: status, ...(resp as object) };
      if (!body.code) body.code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { statusCode: status, error: 'Conflict', code: 'UNIQUE_VIOLATION', message: 'Resource already exists' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { statusCode: status, error: 'Not Found', code: 'NOT_FOUND', message: 'Resource not found' };
      } else {
        this.logger.error({ err: exception, path: req.url }, 'prisma error');
      }
    } else {
      this.logger.error({ err: exception, path: req.url }, 'unhandled error');
    }

    res.status(status).json({ ...body, path: req.url, timestamp: new Date().toISOString() });
  }
}
