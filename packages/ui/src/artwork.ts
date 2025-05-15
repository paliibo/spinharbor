import type { GameArtwork } from '@spinharbor/contracts';

/** Builds a CSS background for a game tile from its procedural artwork description. */
export function artworkBackground(art: GameArtwork): string {
  const [a, b, c] = art.palette;
  return `radial-gradient(120% 90% at 20% 10%, ${a} 0%, transparent 55%), radial-gradient(100% 80% at 90% 90%, ${c} 0%, transparent 50%), linear-gradient(160deg, ${b} 0%, #0b0b10 100%)`;
}
