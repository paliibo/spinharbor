import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { BonusesController } from './bonuses.controller';
import { BonusesService } from './bonuses.service';

@Module({ imports: [WalletModule, UsersModule], controllers: [BonusesController], providers: [BonusesService], exports: [BonusesService] })
export class BonusesModule {}
