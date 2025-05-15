'use client';
import type { GameDetailDto } from '@spinharbor/contracts';
import { CrashGame } from './crash/crash-game';
import { DiceGame } from './dice/dice-game';
import { GameFrame } from './game-frame';
import { RouletteGame } from './roulette/roulette-game';
import { SlotsGame } from './slots/slots-game';

/** Entry point rendered by the game detail page for an authenticated player. */
export function GamePlayer({ game }: { game: GameDetailDto }) {
  return (
    <GameFrame game={game}>
      {(props) => {
        switch (game.engine) {
          case 'SLOTS':
            return <SlotsGame {...props} />;
          case 'DICE':
            return <DiceGame {...props} />;
          case 'ROULETTE':
            return <RouletteGame {...props} />;
          case 'CRASH':
            return <CrashGame {...props} />;
          default:
            return <div className="card-surface p-8 text-center text-muted">This game is a catalogue preview and cannot be played.</div>;
        }
      }}
    </GameFrame>
  );
}
