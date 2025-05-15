import type { SlotSymbol } from '@spinharbor/contracts';
import { cn } from '@/lib/utils';

/** Original procedural artwork for the eight reel symbols. */
export const SYMBOL_META: Record<SlotSymbol, { label: string; color: string; glow: string }> = {
  ANCHOR: { label: 'Anchor (Wild)', color: '#9b6bff', glow: 'rgba(155,107,255,0.6)' },
  GEM: { label: 'Gem', color: '#36d6e7', glow: 'rgba(54,214,231,0.6)' },
  CROWN: { label: 'Crown', color: '#f0c66a', glow: 'rgba(240,198,106,0.6)' },
  BELL: { label: 'Bell', color: '#ffb547', glow: 'rgba(255,181,71,0.6)' },
  SEVEN: { label: 'Seven', color: '#ff5c7a', glow: 'rgba(255,92,122,0.6)' },
  CHERRY: { label: 'Cherry', color: '#ff4d6d', glow: 'rgba(255,77,109,0.6)' },
  LEMON: { label: 'Lemon', color: '#f5e663', glow: 'rgba(245,230,99,0.6)' },
  STAR: { label: 'Star (Scatter)', color: '#f7dc9a', glow: 'rgba(247,220,154,0.7)' },
};

export function SymbolIcon({ symbol, className, size }: { symbol: SlotSymbol; className?: string; size?: number }) {
  const common = { viewBox: '0 0 64 64', width: size, height: size, className: cn('block', className), 'aria-label': SYMBOL_META[symbol].label, role: 'img' as const };
  switch (symbol) {
    case 'ANCHOR':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-anchor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c9b3ff" />
              <stop offset="1" stopColor="#6d3df5" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="12" r="6" fill="none" stroke="url(#sh-anchor)" strokeWidth="4" />
          <path d="M32 18v34" stroke="url(#sh-anchor)" strokeWidth="5" strokeLinecap="round" />
          <path d="M20 28h24" stroke="url(#sh-anchor)" strokeWidth="5" strokeLinecap="round" />
          <path d="M12 38c2 10 10 16 20 16s18-6 20-16l-7 3 3-8" fill="none" stroke="url(#sh-anchor)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 38l7 3-3-8" fill="none" stroke="url(#sh-anchor)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'GEM':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-gem" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bdf6ff" />
              <stop offset="0.5" stopColor="#36d6e7" />
              <stop offset="1" stopColor="#0e7f8f" />
            </linearGradient>
          </defs>
          <path d="M18 12h28l10 14-24 28L8 26z" fill="url(#sh-gem)" />
          <path d="M8 26h48M18 12l6 14 8-14 8 14 6-14M24 26l8 28 8-28" fill="none" stroke="#063a42" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round" />
          <path d="M20 15l5 9" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'CROWN':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-crown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff1c2" />
              <stop offset="0.4" stopColor="#f0c66a" />
              <stop offset="1" stopColor="#b7852b" />
            </linearGradient>
          </defs>
          <path d="M10 46L8 18l14 10 10-16 10 16 14-10-2 28z" fill="url(#sh-crown)" />
          <rect x="10" y="46" width="44" height="7" rx="2" fill="#b7852b" />
          <circle cx="8" cy="17" r="3.5" fill="#ff5c7a" />
          <circle cx="56" cy="17" r="3.5" fill="#ff5c7a" />
          <circle cx="32" cy="11" r="3.5" fill="#36d6e7" />
          <circle cx="22" cy="40" r="3" fill="#6d3df5" />
          <circle cx="32" cy="40" r="3" fill="#6d3df5" />
          <circle cx="42" cy="40" r="3" fill="#6d3df5" />
        </svg>
      );
    case 'BELL':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-bell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe3a8" />
              <stop offset="1" stopColor="#d98b17" />
            </linearGradient>
          </defs>
          <path d="M32 8c-11 0-18 8-18 20v10l-6 8h48l-6-8V28c0-12-7-20-18-20z" fill="url(#sh-bell)" />
          <rect x="29" y="4" width="6" height="6" rx="2" fill="#d98b17" />
          <path d="M24 46h16a8 8 0 0 1-16 0z" fill="#ffb547" />
          <circle cx="32" cy="52" r="4" fill="#8a5a0e" />
          <path d="M22 20c1-5 4-8 8-9" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'SEVEN':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-seven" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff9db0" />
              <stop offset="1" stopColor="#c6173c" />
            </linearGradient>
          </defs>
          <path d="M14 10h38l-20 46H18l18-36H14z" fill="url(#sh-seven)" stroke="#ffd6df" strokeWidth="2" strokeLinejoin="round" />
          <path d="M18 14h28" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'CHERRY':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="sh-cherry" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ff8ea4" />
              <stop offset="0.6" stopColor="#ff4d6d" />
              <stop offset="1" stopColor="#9b1532" />
            </radialGradient>
          </defs>
          <path d="M22 36C26 22 34 14 46 8" fill="none" stroke="#3ad28c" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M44 36C42 24 42 16 46 8" fill="none" stroke="#3ad28c" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M46 8c6 2 10 6 10 12-8 0-12-4-10-12z" fill="#3ad28c" />
          <circle cx="22" cy="44" r="12" fill="url(#sh-cherry)" />
          <circle cx="44" cy="44" r="12" fill="url(#sh-cherry)" />
          <ellipse cx="18" cy="39" rx="3" ry="2" fill="#fff" fillOpacity="0.6" />
          <ellipse cx="40" cy="39" rx="3" ry="2" fill="#fff" fillOpacity="0.6" />
        </svg>
      );
    case 'LEMON':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="sh-lemon" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#fff9b8" />
              <stop offset="0.6" stopColor="#f5e663" />
              <stop offset="1" stopColor="#b59f12" />
            </radialGradient>
          </defs>
          <path d="M12 32c0-11 9-18 20-18s20 7 20 18-9 18-20 18-20-7-20-18z" fill="url(#sh-lemon)" />
          <path d="M8 32h6M50 32h6" stroke="#b59f12" strokeWidth="4" strokeLinecap="round" />
          <path d="M22 24c2-3 5-4 8-4" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M40 16c4-4 8-4 10-2-3 1-5 4-6 6" fill="#3ad28c" />
        </svg>
      );
    case 'STAR':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-star" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff6d6" />
              <stop offset="0.5" stopColor="#f7dc9a" />
              <stop offset="1" stopColor="#d4a84b" />
            </linearGradient>
          </defs>
          <path d="M32 6l7.6 16.8L58 25l-13.6 12.4L48 56 32 46.6 16 56l3.6-18.6L6 25l18.4-2.2z" fill="url(#sh-star)" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M32 14l4 9" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
