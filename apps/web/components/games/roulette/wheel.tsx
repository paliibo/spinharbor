'use client';
import { animate } from 'motion/react';
import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';

export interface WheelHandle {
  /** Spin so that `number` lands under the pointer. Resolves when the animation completes. */
  spinTo: (number: number) => Promise<void>;
}

const R_OUT = 100;
const R_IN = 72;
const R_TEXT = 86;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
}

function sector(a0: number, a1: number) {
  const [x0, y0] = polar(R_OUT, a0);
  const [x1, y1] = polar(R_OUT, a1);
  const [x2, y2] = polar(R_IN, a1);
  const [x3, y3] = polar(R_IN, a0);
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`;
}

export function RouletteWheel({ wheelOrder, redNumbers, ref, onTick, spinning, lastNumber }: { wheelOrder: number[]; redNumbers: number[]; ref: Ref<WheelHandle>; onTick?: () => void; spinning: boolean; lastNumber: number | null }) {
  const wheelRef = useRef<SVGGElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const rotRef = useRef(0);
  const ballRotRef = useRef(0);
  const red = useMemo(() => new Set(redNumbers), [redNumbers]);
  const step = 360 / wheelOrder.length;
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const setWheel = (deg: number) => wheelRef.current?.setAttribute('transform', `rotate(${deg})`);
  const setBall = (deg: number) => ballRef.current?.setAttribute('transform', `rotate(${deg})`);

  useEffect(() => {
    setWheel(rotRef.current);
    setBall(ballRotRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    spinTo: (number: number) =>
      new Promise<void>((resolve) => {
        const idx = Math.max(0, wheelOrder.indexOf(number));
        const cur = rotRef.current;
        const desired = (((-idx * step) % 360) + 360) % 360;
        const curMod = ((cur % 360) + 360) % 360;
        const delta = (desired - curMod + 360) % 360;
        const target = cur + 4 * 360 + delta;
        let lastPocket = Math.floor(cur / step);
        let lastTickAt = 0;
        const duration = 3.4;
        const ease = [0.1, 0.75, 0.2, 1] as const;
        animate(cur, target, {
          duration,
          ease: [...ease],
          onUpdate: (v) => {
            rotRef.current = v;
            setWheel(v);
            const pocket = Math.floor(v / step);
            if (pocket !== lastPocket) {
              lastPocket = pocket;
              const now = performance.now();
              if (now - lastTickAt > 70) {
                lastTickAt = now;
                onTickRef.current?.();
              }
            }
          },
          onComplete: () => {
            rotRef.current = target;
            setWheel(target);
            resolve();
          },
        });
        const ballCur = ballRotRef.current;
        const ballCurMod = ((ballCur % 360) + 360) % 360;
        const ballTarget = ballCur - 3 * 360 - ballCurMod; // ends at 0deg (pointer)
        animate(ballCur, ballTarget, {
          duration,
          ease: [...ease],
          onUpdate: (v) => {
            ballRotRef.current = v;
            setBall(v);
          },
        });
      }),
  }), [wheelOrder, step]);

  return (
    <svg viewBox="-112 -112 224 224" className="mx-auto h-auto w-full max-w-[380px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" role="img" aria-label="Roulette wheel" data-testid="roulette-wheel" data-spinning={spinning ? 'true' : 'false'}>
      <defs>
        <radialGradient id="sh-wheel-rim" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.85" stopColor="#3a2a12" />
          <stop offset="0.93" stopColor="#f0c66a" />
          <stop offset="1" stopColor="#8a6420" />
        </radialGradient>
        <radialGradient id="sh-wheel-hub" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#2a2a3a" />
          <stop offset="1" stopColor="#0b0b10" />
        </radialGradient>
        <radialGradient id="sh-ball" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8d8da0" />
        </radialGradient>
      </defs>
      <circle r="110" fill="url(#sh-wheel-rim)" />
      <circle r="103" fill="#0b0b10" />
      <g ref={wheelRef}>
        {wheelOrder.map((n, i) => {
          const a0 = i * step - step / 2;
          const a1 = a0 + step;
          const fill = n === 0 ? '#1f9d63' : red.has(n) ? '#c81e3c' : '#15151f';
          const [tx, ty] = polar(R_TEXT, i * step);
          return (
            <g key={n}>
              <path d={sector(a0, a1)} fill={fill} stroke="#f0c66a" strokeOpacity="0.55" strokeWidth="0.6" />
              <text x={tx} y={ty} fill="#f8f4e6" fontSize="7.5" fontWeight="700" textAnchor="middle" dominantBaseline="central" transform={`rotate(${i * step} ${tx} ${ty})`} style={{ fontFamily: 'var(--font-sans)' }}>
                {n}
              </text>
            </g>
          );
        })}
        <circle r={R_IN} fill="none" stroke="#f0c66a" strokeWidth="1.2" />
        <circle r={R_IN - 4} fill="url(#sh-wheel-hub)" stroke="#343448" strokeWidth="0.8" />
        {Array.from({ length: 8 }).map((_, i) => {
          const [x, y] = polar(R_IN - 10, i * 45);
          return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="#6d3df5" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />;
        })}
        <circle r="14" fill="#1a1a25" stroke="#f0c66a" strokeWidth="1.5" />
        <circle r="5" fill="#d4a84b" />
      </g>
      {/* ball track + ball */}
      <circle r={R_OUT + 4} fill="none" stroke="#2b2b3a" strokeWidth="1" />
      <g ref={ballRef}>
        <circle cx="0" cy={-(R_OUT - 8)} r="4.2" fill="url(#sh-ball)" stroke="#0b0b10" strokeWidth="0.6" />
      </g>
      {/* fixed pointer */}
      <path d="M-6 -111 L6 -111 L0 -99 Z" fill="#f0c66a" stroke="#0b0b10" strokeWidth="0.8" />
      {lastNumber !== null && !spinning && (
        <text x="0" y="0" fill="#f2f1f7" fontSize="9" fontWeight="800" textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font-sans)' }}>
          {lastNumber}
        </text>
      )}
    </svg>
  );
}
