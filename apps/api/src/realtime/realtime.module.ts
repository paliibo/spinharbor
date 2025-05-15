import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({ imports: [GamesModule], providers: [RealtimeGateway] })
export class RealtimeModule {}
