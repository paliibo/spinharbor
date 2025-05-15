import { Module } from '@nestjs/common';
import { LimitsService } from './limits.service';
import { ResponsibleGamingController } from './responsible-gaming.controller';
import { ResponsibleGamingService } from './responsible-gaming.service';
import { RiskService } from './risk.service';

@Module({
  controllers: [ResponsibleGamingController],
  providers: [LimitsService, RiskService, ResponsibleGamingService],
  exports: [LimitsService, RiskService, ResponsibleGamingService],
})
export class RiskModule {}
