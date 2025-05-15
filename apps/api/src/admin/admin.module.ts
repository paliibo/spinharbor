import { Module } from '@nestjs/common';
import { CasinoModule } from '../casino/casino.module';
import { ProvidersModule } from '../providers/providers.module';
import { RiskModule } from '../risk/risk.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminCatalogueService } from './admin-catalogue.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminPlayersService } from './admin-players.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [CasinoModule, ProvidersModule, RiskModule, WalletModule],
  controllers: [AdminController],
  providers: [AdminMetricsService, AdminPlayersService, AdminCatalogueService, AdminSettingsService],
})
export class AdminModule {}
