import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Marker a service or controller can return so the interceptor knows which
 * part of the payload is `data` and which is `meta`.
 *
 * Returning `{ data, meta }` from a controller is the only way to populate
 * `meta`; a bare value becomes `data` with no `meta` key.
 */
export interface Enveloped<TData, TMeta = Record<string, unknown>> {
  data: TData;
  meta?: TMeta;
}

function isEnveloped(value: unknown): value is Enveloped<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Object.keys(value).every((key) => key === 'data' || key === 'meta')
  );
}

/**
 * Wraps every successful response in the envelope from PROJECT_PLAN.md §8:
 *
 *     { "success": true, "data": {}, "meta": {} }
 *
 * Controllers never build this by hand. File streams (CSV exports) pass
 * through untouched.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof StreamableFile) return payload;

        if (isEnveloped(payload)) {
          return payload.meta === undefined
            ? { success: true, data: payload.data }
            : { success: true, data: payload.data, meta: payload.meta };
        }

        return { success: true, data: payload ?? null };
      }),
    );
  }
}
