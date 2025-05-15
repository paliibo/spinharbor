import { InjectQueue, BullModule } from '@nestjs/bullmq';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { BonusesModule } from '../bonuses/bonuses.module';
import { GamesModule } from '../games/games.module';
import { RiskModule } from '../risk/risk.module';
import type { Env } from '../config/env';
import { MAINTENANCE_QUEUE, MaintenanceProcessor } from './maintenance.processor';

const SCHEDULES: { name: string; every: number }[] = [
  { name: 'expire-bonuses', every: 5 * 60_000 },
  { name: 'expire-sessions', every: 10 * 60_000 },
  { name: 'cleanup-idempotency', every: 60 * 60_000 },
  { name: 'reconcile-wallets', every: 30 * 60_000 },
];

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = new URL(config.get('REDIS_URL'));
        return { prefix: config.get('NODE_ENV') === 'test' ? 'spinharbor-test' : 'spinharbor', connection: { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined } };
      },
    }),
    BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
    BonusesModule,
    GamesModule,
    RiskModule,
  ],
  providers: [MaintenanceProcessor],
})
export class JobsModule implements OnModuleInit {
  private readonly log = new Logger(JobsModule.name);
  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    for (const s of SCHEDULES) {
      await this.queue.upsertJobScheduler(s.name, { every: s.every }, { name: s.name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
    }
    this.log.log(`scheduled ${SCHEDULES.length} maintenance jobs`);
  }
}
