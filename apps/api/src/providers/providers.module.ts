import { Module } from '@nestjs/common';
import { DemoCasinoProvider } from './demo-casino.provider';
import { ProviderRegistry } from './provider-registry.service';

@Module({ providers: [DemoCasinoProvider, ProviderRegistry], exports: [ProviderRegistry, DemoCasinoProvider] })
export class ProvidersModule {}
