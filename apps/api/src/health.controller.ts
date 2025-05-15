import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { Public } from './common/decorators/auth.decorators';
import { PrismaService } from './common/prisma/prisma.service';
import { REDIS } from './common/redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async health() {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down'),
      this.redis.ping().then(() => 'up').catch(() => 'down'),
    ]);
    return { status: db === 'up' && redis === 'up' ? 'ok' : 'degraded', db, redis, time: new Date().toISOString() };
  }
}
