import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { Observable, mergeMap, of } from 'rxjs';
import { Errors } from '../errors/domain.errors';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBigInts } from './bigint.interceptor';

export const IDEMPOTENT_KEY = 'idempotentScope';
/** Marks a financial mutation endpoint: retries with the same key replay the stored response. */
export const Idempotent = (scope: string) => SetMetadata(IDEMPOTENT_KEY, scope);

const RECORD_TTL_MS = 24 * 3600 * 1000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const scope = this.reflector.get<string | undefined>(IDEMPOTENT_KEY, ctx.getHandler());
    if (!scope) return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const headerKey = req.headers['idempotency-key'];
    const key = (typeof headerKey === 'string' ? headerKey : (req.body as any)?.idempotencyKey) as string | undefined;
    const user = (req as any).user as { id: string } | undefined;
    if (!key || !user) return next.handle();

    const fullKey = `${user.id}:${scope}:${key}`;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');
    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key: fullKey } });
    if (existing && existing.expiresAt > new Date()) {
      if (existing.requestHash !== requestHash) {
        throw Errors.conflict('IDEMPOTENCY_MISMATCH', 'Idempotency key reused with a different request body');
      }
      res.status(existing.statusCode);
      res.setHeader('Idempotent-Replayed', 'true');
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      mergeMap(async (body) => {
        const serialized = serializeBigInts(body);
        await this.prisma.idempotencyRecord
          .upsert({
            where: { key: fullKey },
            create: { key: fullKey, userId: user.id, scope, requestHash, statusCode: res.statusCode, responseBody: serialized as any, expiresAt: new Date(Date.now() + RECORD_TTL_MS) },
            update: {},
          })
          .catch(() => undefined);
        return serialized;
      }),
    );
  }
}
