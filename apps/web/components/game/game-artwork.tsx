import type { GameArtwork } from '@spinharbor/contracts';
import { cn } from '@/lib/utils';

/**
 * Original procedural game artwork. Every tile is drawn from a palette + motif description stored
 * in the catalogue, so no third-party assets are used anywhere.
 */
export function GameArtworkVisual({ art, className, size = 'md' }: { art: GameArtwork; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [a, b, c] = art.palette;
  const bg = `radial-gradient(120% 90% at 20% 10%, ${a} 0%, transparent 55%), radial-gradient(100% 80% at 90% 90%, ${c} 0%, transparent 50%), linear-gradient(160deg, ${b} 0%, #0b0b10 100%)`;
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} style={{ background: bg }}>
      <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`g-${art.motif}-${a.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} stopOpacity="0.9" />
            <stop offset="100%" stopColor={c} stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`r-${a.replace('#', '')}`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Motif motif={art.motif} a={a} b={b} c={c} grad={`url(#g-${art.motif}-${a.replace('#', '')})`} glow={`url(#r-${a.replace('#', '')})`} />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <div className={cn('pointer-events-none absolute inset-0 opacity-[0.07]', size !== 'sm' && 'bg-[linear-gradient(0deg,transparent_24%,#fff_25%,#fff_26%,transparent_27%,transparent_74%,#fff_75%,#fff_76%,transparent_77%),linear-gradient(90deg,transparent_24%,#fff_25%,#fff_26%,transparent_27%,transparent_74%,#fff_75%,#fff_76%,transparent_77%)] bg-[length:40px_40px]')} />
    </div>
  );
}

function Motif({ motif, a, b, c, grad, glow }: { motif: string; a: string; b: string; c: string; grad: string; glow: string }) {
  const stroke = '#fff';
  switch (motif) {
    case 'reels':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={30 + i * 50} y={70} width={40} height={120} rx={8} fill={b} stroke={stroke} strokeOpacity={0.35} />
          ))}
          {[0, 1, 2].map((i) => (
            <g key={`s${i}`}>
              <circle cx={50 + i * 50} cy={100} r={11} fill={grad} />
              <polygon points={`${50 + i * 50},118 ${60 + i * 50},142 ${40 + i * 50},142`} fill={c} opacity={0.9} />
              <rect x={40 + i * 50} y={152} width={20} height={20} rx={4} fill={a} />
            </g>
          ))}
          <circle cx={100} cy={40} r={60} fill={glow} />
        </g>
      );
    case 'dice':
      return (
        <g>
          <rect x={40} y={80} width={70} height={70} rx={14} fill={a} transform="rotate(-12 75 115)" />
          {[[60, 100], [90, 130], [75, 115]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={6} fill={b} transform="rotate(-12 75 115)" />
          ))}
          <rect x={100} y={120} width={64} height={64} rx={12} fill={c} transform="rotate(18 132 152)" />
          {[[116, 136], [148, 168], [116, 168], [148, 136]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5} fill={b} transform="rotate(18 132 152)" />
          ))}
          <circle cx={60} cy={60} r={50} fill={glow} />
        </g>
      );
    case 'wheel':
      return (
        <g transform="translate(100 140)">
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={i} d={describeArc(0, 0, 70, i * 20, i * 20 + 20)} fill={i % 2 === 0 ? a : i % 3 === 0 ? c : b} stroke={stroke} strokeOpacity={0.25} />
          ))}
          <circle r={34} fill={b} stroke={stroke} strokeOpacity={0.4} strokeWidth={2} />
          <circle r={8} fill={c} />
          <circle cx={0} cy={-56} r={6} fill="#fff" opacity={0.9} />
        </g>
      );
    case 'rocket':
      return (
        <g>
          <path d="M20 220 Q 90 200 120 120 T 190 30" stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="6 6" opacity={0.8} />
          <path d="M20 230 Q 80 215 110 150 T 180 60" stroke={a} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
          <g transform="translate(150 70) rotate(-40)">
            <path d="M0 -26 C 12 -14 12 10 0 26 C -12 10 -12 -14 0 -26 Z" fill="#fff" opacity={0.95} />
            <circle cy={-4} r={5} fill={a} />
            <path d="M-10 10 L -18 24 L -4 18 Z" fill={c} />
            <path d="M10 10 L 18 24 L 4 18 Z" fill={c} />
          </g>
          <circle cx={150} cy={70} r={50} fill={glow} />
        </g>
      );
    case 'gems':
      return (
        <g>
          <polygon points="100,60 140,100 100,190 60,100" fill={grad} stroke="#fff" strokeOpacity={0.5} />
          <polygon points="100,60 140,100 60,100" fill="#fff" opacity={0.25} />
          <polygon points="60,100 100,190 100,100" fill={b} opacity={0.4} />
          <polygon points="40,150 60,170 40,210 20,170" fill={c} opacity={0.85} />
          <polygon points="160,140 180,160 160,200 140,160" fill={a} opacity={0.85} />
        </g>
      );
    case 'fruits':
      return (
        <g>
          <circle cx={75} cy={130} r={28} fill={a} />
          <circle cx={115} cy={150} r={28} fill={c} />
          <path d="M80 102 Q 100 70 125 95" stroke="#7bd389" strokeWidth={5} fill="none" strokeLinecap="round" />
          <ellipse cx={118} cy={92} rx={14} ry={7} fill="#7bd389" transform="rotate(-30 118 92)" />
          <circle cx={66} cy={120} r={6} fill="#fff" opacity={0.5} />
        </g>
      );
    case 'cards':
      return (
        <g>
          <rect x={45} y={70} width={70} height={100} rx={8} fill="#fff" transform="rotate(-14 80 120)" />
          <rect x={85} y={80} width={70} height={100} rx={8} fill="#fff" transform="rotate(10 120 130)" />
          <text x={100} y={140} fontSize={44} fontWeight={800} textAnchor="middle" fill={a} transform="rotate(10 120 130)">
            A
          </text>
          <path d="M120 100 l6 8 l-6 8 l-6 -8 z" fill={a} transform="rotate(10 120 130)" />
        </g>
      );
    case 'pyramid':
      return (
        <g>
          <polygon points="100,50 180,190 20,190" fill={grad} />
          <polygon points="100,50 180,190 100,190" fill={b} opacity={0.5} />
          <circle cx={150} cy={50} r={18} fill={c} />
          <path d="M20 200 H180" stroke={stroke} strokeOpacity={0.3} strokeWidth={2} />
        </g>
      );
    case 'ocean':
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 ${120 + i * 28} C 40 ${100 + i * 28}, 70 ${140 + i * 28}, 100 ${120 + i * 28} S 160 ${100 + i * 28}, 200 ${120 + i * 28}`} stroke={i % 2 ? a : c} strokeWidth={4} fill="none" opacity={0.8 - i * 0.15} />
          ))}
          <circle cx={60} cy={60} r={22} fill="#fff" opacity={0.85} />
          <circle cx={60} cy={60} r={50} fill={glow} />
        </g>
      );
    case 'dragon':
      return (
        <g>
          <path d="M30 170 C 60 60, 110 60, 120 120 S 170 170, 180 90" stroke={a} strokeWidth={14} fill="none" strokeLinecap="round" />
          <path d="M30 170 C 60 60, 110 60, 120 120 S 170 170, 180 90" stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="10 14" />
          <circle cx={180} cy={88} r={12} fill={c} />
          <circle cx={183} cy={86} r={4} fill="#000" />
        </g>
      );
    case 'space':
      return (
        <g>
          {Array.from({ length: 24 }).map((_, i) => (
            <circle key={i} cx={(i * 53) % 200} cy={(i * 97) % 260} r={i % 5 === 0 ? 2.5 : 1.2} fill="#fff" opacity={0.7} />
          ))}
          <circle cx={100} cy={130} r={42} fill={grad} />
          <ellipse cx={100} cy={130} rx={70} ry={16} fill="none" stroke={c} strokeWidth={4} transform="rotate(-18 100 130)" />
        </g>
      );
    case 'jungle':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={40 + i * 32} cy={170 - (i % 2) * 40} rx={22} ry={54} fill={i % 2 ? a : c} opacity={0.85} transform={`rotate(${-30 + i * 15} ${40 + i * 32} ${170 - (i % 2) * 40})`} />
          ))}
          <circle cx={150} cy={60} r={20} fill="#ffd166" />
        </g>
      );
    case 'frost':
      return (
        <g transform="translate(100 130)">
          {[0, 60, 120].map((r) => (
            <g key={r} transform={`rotate(${r})`}>
              <line x1={-70} y1={0} x2={70} y2={0} stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.9} />
              {[-40, 40].map((x) => (
                <g key={x}>
                  <line x1={x} y1={0} x2={x + (x > 0 ? 14 : -14)} y2={-14} stroke={c} strokeWidth={4} strokeLinecap="round" />
                  <line x1={x} y1={0} x2={x + (x > 0 ? 14 : -14)} y2={14} stroke={c} strokeWidth={4} strokeLinecap="round" />
                </g>
              ))}
            </g>
          ))}
        </g>
      );
    case 'volcano':
      return (
        <g>
          <polygon points="100,70 190,210 10,210" fill={b} />
          <polygon points="100,70 130,120 70,120" fill={a} />
          <path d="M100 70 C 90 40, 120 30, 110 10" stroke={c} strokeWidth={6} fill="none" strokeLinecap="round" />
          <circle cx={100} cy={70} r={40} fill={glow} />
        </g>
      );
    case 'clover':
      return (
        <g transform="translate(100 130)">
          {[0, 90, 180, 270].map((r) => (
            <path key={r} d="M0 0 C -30 -30, -30 -70, 0 -60 C 30 -70, 30 -30, 0 0 Z" fill={a} transform={`rotate(${r})`} />
          ))}
          <circle r={8} fill={c} />
        </g>
      );
    case 'coins':
      return (
        <g>
          {[[60, 150, a], [110, 120, c], [150, 160, a], [90, 185, c]].map(([x, y, col], i) => (
            <g key={i}>
              <ellipse cx={x as number} cy={(y as number) + 6} rx={28} ry={10} fill="#000" opacity={0.25} />
              <ellipse cx={x as number} cy={y as number} rx={28} ry={12} fill={col as string} stroke="#fff" strokeOpacity={0.5} />
            </g>
          ))}
          <circle cx={100} cy={60} r={50} fill={glow} />
        </g>
      );
    case 'neon':
      return (
        <g>
          <rect x={40} y={70} width={120} height={120} rx={18} fill="none" stroke={a} strokeWidth={5} />
          <rect x={60} y={90} width={80} height={80} rx={12} fill="none" stroke={c} strokeWidth={4} />
          <rect x={80} y={110} width={40} height={40} rx={8} fill={grad} />
          <circle cx={100} cy={130} r={70} fill={glow} />
        </g>
      );
    case 'anchor':
    default:
      return (
        <g transform="translate(100 130)">
          <circle r={14} fill="none" stroke="#fff" strokeWidth={6} cy={-56} />
          <line x1={0} y1={-42} x2={0} y2={50} stroke="#fff" strokeWidth={8} strokeLinecap="round" />
          <line x1={-34} y1={-14} x2={34} y2={-14} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
          <path d="M-60 20 C -50 60, 50 60, 60 20" stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />
          <circle r={60} fill={glow} cy={-20} />
        </g>
      );
  }
}

function describeArc(x: number, y: number, r: number, startAngle: number, endAngle: number) {
  const s = polar(x, y, r, endAngle);
  const e = polar(x, y, r, startAngle);
  return `M ${x} ${y} L ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${e.x} ${e.y} Z`;
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
