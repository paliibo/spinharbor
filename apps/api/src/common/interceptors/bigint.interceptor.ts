import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Ledger amounts are BigInt internally. On the wire they are plain integers (minor units); the
 * interceptor refuses to silently lose precision.
 */
export function serializeBigInts<T>(value: T): T {
  if (typeof value === 'bigint') {
    if (value > MAX_SAFE || value < -MAX_SAFE) throw new Error('BigInt exceeds safe integer range for JSON');
    return Number(value) as unknown as T;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serializeBigInts) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serializeBigInts(v);
    return out as T;
  }
  return value;
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeBigInts(data)));
  }
}
