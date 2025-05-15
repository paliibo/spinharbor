import { Module } from '@nestjs/common';
import { CasinoController } from './casino.controller';
import { CatalogueService } from './catalogue.service';

@Module({ controllers: [CasinoController], providers: [CatalogueService], exports: [CatalogueService] })
export class CasinoModule {}
