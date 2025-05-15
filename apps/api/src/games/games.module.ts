import { Module } from '@nestjs/common';
import { BonusesModule } from '../bonuses/bonuses.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ProvidersModule } from '../providers/providers.module';
import { RiskModule } from '../risk/risk.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { CrashController } from './crash/crash.controller';
import { CrashService } from './crash/crash.service';
import { GameplayService } from './gameplay.service';
import { GamesController } from './games.controller';
import { RoundsService } from './rounds.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [WalletModule, UsersModule, RiskModule, LoyaltyModule, BonusesModule, ProvidersModule],
  controllers: [GamesController, CrashController],
  providers: [SessionsService, GameplayService, RoundsService, CrashService],
  exports: [SessionsService, GameplayService, RoundsService, CrashService],
})
export class GamesModule {}
