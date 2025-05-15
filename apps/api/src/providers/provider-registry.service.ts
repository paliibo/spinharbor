import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Errors } from '../common/errors/domain.errors';
import type { CasinoGameProvider } from './casino-game-provider.interface';
import { DemoCasinoProvider } from './demo-casino.provider';
import { ExternalStubProvider } from './external-stub.provider';

/** Resolves a provider adapter by its catalogue code and checks its operational status. */
@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly adapters = new Map<string, CasinoGameProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoCasinoProvider,
  ) {}

  async onModuleInit() {
    this.adapters.set(this.demo.code, this.demo);
    const others = await this.prisma.casinoProvider.findMany({ where: { code: { not: this.demo.code } } });
    for (const p of others) this.adapters.set(p.code, new ExternalStubProvider(p.code, 'integration stub – no live connection configured'));
  }

  async resolve(code: string): Promise<CasinoGameProvider> {
    const row = await this.prisma.casinoProvider.findUnique({ where: { code } });
    if (!row) throw Errors.notFound('Provider');
    if (row.status !== 'OPERATIONAL') {
      await this.prisma.providerErrorLog.create({ data: { providerId: row.id, message: `Session requested while provider is ${row.status}` } }).catch(() => undefined);
      throw Errors.conflict('PROVIDER_UNAVAILABLE', `Provider ${row.name} is ${row.status.toLowerCase().replace('_', ' ')}`);
    }
    let adapter = this.adapters.get(code);
    if (!adapter) {
      adapter = new ExternalStubProvider(code, 'integration stub – no live connection configured');
      this.adapters.set(code, adapter);
    }
    return adapter;
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }
}
