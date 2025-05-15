import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@spinharbor/database';

export type Tx = Prisma.TransactionClient;

/**
 * Options for financial transactions: requests for the same wallet queue on its row lock, so a
 * transaction may legitimately wait longer than Prisma's 2 s / 5 s defaults under load.
 */
export const FINANCIAL_TX = { maxWait: 10_000, timeout: 20_000 } as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : process.env.NODE_ENV === 'test' ? [] : ['error'] });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
