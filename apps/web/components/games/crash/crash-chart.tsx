'use client';
import { useMemo } from 'react';
import { crashMultiplierAt, type CrashPhase } from '@/features/games/use-crash';
import { formatMultiplier } from '@/lib/format';
import { cn } from '@/lib/utils';

const W = 600;
const H = 300;
const PAD = { l: 44, r: 16, t: 16, b: 28 };

/** Curve of m(t) = 2^(t/10s) drawn analytically up to the current elapsed time, so no per-frame state is kept. */
export function CrashChart({ elapsedMs, multiplierBp, phase, countdownMs, className }: { elapsedMs: number; multiplierBp: number; phase: CrashPhase; countdownMs: number; className?: string }) {
  const running = phase === 'RUNNING';
  const crashed = phase === 'CRASHED' || phase === 'SETTLED';
  const active = running || crashed;

  const { path, area, endX, endY, yTicks, xTicks } = useMemo(() => {
    const tMax = Math.max(8000, elapsedMs * 1.05);
    const mMax = Math.max(1.8, (multiplierBp / 10_000) * 1.15);
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (t: number) => PAD.l + (t / tMax) * iw;
    const y = (m: number) => PAD.t + ih - ((m - 1) / (mMax - 1)) * ih;
    const n = 70;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (elapsedMs * i) / n;
      const m = active ? crashMultiplierAt(t) / 10_000 : 1;
      pts.push(`${x(t).toFixed(1)} ${y(m).toFixed(1)}`);
    }
    const endT = active ? elapsedMs : 0;
    const endM = active ? multiplierBp / 10_000 : 1;
    const d = `M${pts.join('L')}`;
    const a = `${d}L${x(endT).toFixed(1)} ${y(1).toFixed(1)}L${x(0).toFixed(1)} ${y(1).toFixed(1)}Z`;
    const ySteps = mMax <= 3 ? 0.5 : mMax <= 8 ? 1 : mMax <= 20 ? 2.5 : mMax <= 60 ? 10 : 25;
    const yt: { v: number; y: number }[] = [];
    for (let v = 1; v <= mMax; v += ySteps) yt.push({ v, y: y(v) });
    const xStep = tMax <= 12_000 ? 2000 : tMax <= 30_000 ? 5000 : 10_000;
    const xt: { v: number; x: number }[] = [];
    for (let v = 0; v <= tMax; v += xStep) xt.push({ v, x: x(v) });
    return { path: d, area: a, endX: x(endT), endY: y(endM), yTicks: yt, xTicks: xt };
  }, [elapsedMs, multiplierBp, active]);

  const stroke = crashed ? '#ff5c7a' : '#36d6e7';

  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_bottom_left,rgba(109,61,245,0.18),transparent_60%),#0b0b10]', className)} data-testid="crash-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="sh-crash-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <filter id="sh-crash-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#272736" strokeWidth="1" strokeDasharray="3 5" />
            <text x={PAD.l - 6} y={t.y} fill="#6f6d82" fontSize="10" textAnchor="end" dominantBaseline="central" style={{ fontFamily: 'var(--font-sans)' }}>
              {t.v.toFixed(t.v % 1 ? 1 : 0)}x
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.v} x={t.x} y={H - 8} fill="#6f6d82" fontSize="10" textAnchor="middle" style={{ fontFamily: 'var(--font-sans)' }}>
            {(t.v / 1000).toFixed(0)}s
          </text>
        ))}
        {active && (
          <>
            <path d={area} fill="url(#sh-crash-area)" />
            <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#sh-crash-glow)" />
            <circle cx={endX} cy={endY} r={crashed ? 7 : 5} fill={stroke} className={running ? 'animate-pulse-soft' : undefined} />
          </>
        )}
      </svg>

      {/* readout overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {phase === 'OFFLINE' && <span className="text-sm text-muted">Connecting to the crash feed…</span>}
        {phase === 'WAITING' && (
          <>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Next round</span>
            <span className="mt-1 text-3xl font-black tabular text-text">{(countdownMs / 1000).toFixed(1)}s</span>
          </>
        )}
        {phase === 'BETTING_OPEN' && (
          <>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan">Betting open</span>
            <span className="mt-1 text-4xl font-black tabular text-text sm:text-5xl">{(countdownMs / 1000).toFixed(1)}s</span>
            <span className="mt-1 text-xs text-muted">place your bet before launch</span>
          </>
        )}
        {(running || crashed) && (
          <>
            {crashed && <span className="text-xs font-semibold uppercase tracking-[0.25em] text-danger">Crashed</span>}
            <span className={cn('text-5xl font-black tabular drop-shadow-[0_0_30px_rgba(54,214,231,0.35)] sm:text-7xl', crashed ? 'text-danger' : 'text-text')} data-testid="crash-multiplier">
              {formatMultiplier(multiplierBp)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
