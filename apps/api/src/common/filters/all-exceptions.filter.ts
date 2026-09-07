import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import type { ApiErrorCode, ApiErrorDetail } from '@isd/shared-types';

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Anything at or above this is logged as an error with its stack; below it is
 * a warning. Annotated `number` because `status` is a plain number, not a
 * HttpStatus member.
 */
const SERVER_ERROR_FLOOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

interface NormalisedError {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

/**
 * The single place an error envelope is produced (PROJECT_PLAN.md §8, §12.3).
 *
 * Two rules it exists to enforce:
 *   1. Every failure has the same shape, so the frontends have one error path.
 *   2. Stack traces and raw Mongo errors never reach a production client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalised = this.normalise(exception);

    if (normalised.status >= SERVER_ERROR_FLOOR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${normalised.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} → ${normalised.status} ${normalised.code}: ${normalised.message}`,
      );
    }

    response.status(normalised.status).json({
      success: false,
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.details?.length ? { details: normalised.details } : {}),
      },
    });
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof mongoose.Error.ValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        details: Object.entries(exception.errors).map(([field, error]) => ({
          field,
          message: error.message,
        })),
      };
    }

    if (exception instanceof mongoose.Error.CastError) {
      // A malformed ObjectId in a path parameter. Surfacing the Mongo text here
      // would leak the schema, so this is deliberately generic.
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: `Invalid value for '${exception.path}'.`,
      };
    }

    if (this.isDuplicateKeyError(exception)) {
      const field = Object.keys(exception.keyPattern ?? {})[0] ?? 'value';
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: `A record with this ${field} already exists.`,
        details: [{ field, message: 'Must be unique.' }],
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: this.isProduction
        ? 'Something went wrong. Please try again.'
        : exception instanceof Error
          ? exception.message
          : String(exception),
    };
  }

  private fromHttpException(exception: HttpException): NormalisedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const code = STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR';

    if (typeof payload === 'string') {
      return { status, code, message: payload };
    }

    const body = payload as {
      message?: string | string[];
      error?: string;
      code?: ApiErrorCode;
      details?: ApiErrorDetail[];
    };

    // The global ValidationPipe hands us `message: string[]`.
    if (Array.isArray(body.message)) {
      return {
        status,
        code: body.code ?? code,
        message: 'One or more fields failed validation.',
        details: body.message.map((message) => ({ message })),
      };
    }

    return {
      status,
      code: body.code ?? code,
      message: body.message ?? body.error ?? 'Request failed.',
      details: body.details,
    };
  }

  private isDuplicateKeyError(
    exception: unknown,
  ): exception is { code: number; keyPattern?: Record<string, unknown> } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      exception.code === 11000
    );
  }
}
