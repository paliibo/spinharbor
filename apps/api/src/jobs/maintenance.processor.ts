import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BonusesService } from '../bonuses/bonuses.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SessionsService } from '../games/sessions.service';
import { LedgerService } from '../ledger/ledger.service';
import { RiskService } from '../risk/risk.service';

export const MAINTENANCE_QUEUE = 'maintenance';

/** Non-critical asynchronous housekeeping, executed by BullMQ on a schedule. */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly log = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly bonuses: BonusesService,
    private readonly sessions: SessionsService,
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
    private readonly risk: RiskService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case 'expire-bonuses': {
        const n = await this.bonuses.expireBonuses();
        if (n) this.log.log(`expired ${n} bonus(es)`);
        return { expired: n };
      }
      case 'expire-sessions': {
        const n = await this.sessions.expireIdle();
        if (n) this.log.log(`expired ${n} idle session(s)`);
        return { expired: n };
      }
      case 'cleanup-idempotency': {
        const r = await this.prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        return { deleted: r.count };
      }
      case 'reconcile-wallets': {
        const wallets = await this.prisma.wallet.findMany({ select: { userId: true } });
        const mismatches: string[] = [];
        for (const w of wallets) {
          const r = await this.ledger.reconcileUser(w.userId);
          if (!r.ok) {
            mismatches.push(w.userId);
            await this.risk.flag(w.userId, 'LEDGER_MISMATCH', 'HIGH', 'Cached wallet balance differs from journal', { walletCash: Number(r.walletCashMinor), ledgerCash: Number(r.ledgerCashMinor) });
          }
        }
        const global = await this.ledger.globalBalance();
        if (global !== 0n) this.log.error(`Global journal sum is ${global} (expected 0)`);
        if (mismatches.length) this.log.error(`Wallet/ledger mismatch for ${mismatches.length} user(s)`);
        return { checked: wallets.length, mismatches: mismatches.length, globalSum: Number(global) };
      }
      default:
        this.log.warn(`unknown job ${job.name}`);
        return null;
    }
  }
}
