import { Global, Injectable, Module } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/**
 * In-process domain event bus. Services publish after their DB transaction commits; the realtime
 * gateway and background jobs subscribe. Keeps modules decoupled (no circular imports).
 */
export interface DomainEventMap {
  'wallet.updated': { userId: string; balanceMinor: bigint; bonusBalanceMinor: bigint; version: number; reason: string };
  'round.settled': { userId: string; roundId: string; engine: string; gameSlug: string; gameName: string; stakeMinor: bigint; payoutMinor: bigint; username: string };
  'account.status': { userId: string; status: string; statusUntil: Date | null; reason: string | null };
  'bonus.claimed': { userId: string; username: string; bonusName: string; amountMinor: bigint };
  'session.started': { userId: string; username: string; gameName: string; sessionId: string };
  'risk.flagged': { userId: string; code: string; severity: string };
  'crash.state': { round: import('@spinharbor/contracts').CrashRoundDto };
  'crash.tick': { roundId: string; multiplierBp: number; elapsedMs: number; serverTime: string };
  'crash.bet': { roundId: string; bet: import('@spinharbor/contracts').CrashBetDto };
  'crash.cashout': { roundId: string; bet: import('@spinharbor/contracts').CrashBetDto };
  'crash.crashed': { roundId: string; crashMultiplierBp: number; serverSeed: string; history: import('@spinharbor/contracts').CrashHistoryItem[] };
}

@Injectable()
export class DomainEvents {
  private readonly emitter = new EventEmitter({ captureRejections: false });
  constructor() {
    this.emitter.setMaxListeners(50);
  }
  publish<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]) {
    // setImmediate so handlers never run inside the publisher's call stack/transaction.
    setImmediate(() => this.emitter.emit(event, payload));
  }
  subscribe<K extends keyof DomainEventMap>(event: K, handler: (payload: DomainEventMap[K]) => unknown) {
    const wrapped = (p: DomainEventMap[K]) => {
      Promise.resolve(handler(p)).catch(() => undefined);
    };
    this.emitter.on(event, wrapped);
    return () => this.emitter.off(event, wrapped);
  }
}

@Global()
@Module({ providers: [DomainEvents], exports: [DomainEvents] })
export class DomainEventsModule {}
