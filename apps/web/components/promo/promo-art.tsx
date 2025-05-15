import type { GameArtwork, PromotionDto } from '@spinharbor/contracts';
import { GameArtworkVisual } from '@/components/game/game-artwork';

/** Promotions reuse the catalogue's procedural artwork so banners never need external assets. */
export function PromoArt({ artwork, className, size = 'lg' }: { artwork: PromotionDto['artwork']; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const art: GameArtwork = { palette: artwork.palette, motif: artwork.motif as GameArtwork['motif'] };
  return <GameArtworkVisual art={art} className={className} size={size} />;
}
