import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BonusesModule } from './bonuses/bonuses.module';
import { CasinoModule } from './casino/casino.module';
import { DomainEventsModule } from './common/events/domain-events';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { RngModule } from './common/rng/rng.module';
import { validateEnv } from './config/env';
import { GamesModule } from './games/games.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { LedgerModule } from './ledger/ledger.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProvidersModule } from './providers/providers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RiskModule } from './risk/risk.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['.env', '../../.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } } : undefined,
        autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/health') || (req.url ?? '').startsWith('/socket.io') },
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        customProps: () => ({ service: 'spinharbor-api' }),
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    PrismaModule,
    RedisModule,
    RngModule,
    DomainEventsModule,
    AuditModule,
    LedgerModule,
    UsersModule,
    WalletModule,
    AuthModule,
    CasinoModule,
    ProvidersModule,
    RiskModule,
    LoyaltyModule,
    BonusesModule,
    GamesModule,
    NotificationsModule,
    RealtimeModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: BigIntSerializerInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
