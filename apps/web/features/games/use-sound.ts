'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Tiny synthesized sound effects via the Web Audio API — no asset files.
 * Audible only when the profile has sound enabled AND the local toggle (persisted) is on.
 */
export type SoundName = 'spin' | 'win' | 'bigwin' | 'lose' | 'tick' | 'cashout' | 'click' | 'crash';

const STORAGE_KEY = 'spinharbor:sound';

interface SoundState {
  localEnabled: boolean;
  setLocalEnabled: (v: boolean) => void;
}

function readStored(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export const useSoundStore = create<SoundState>((set) => ({
  localEnabled: true,
  setLocalEnabled: (v) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ localEnabled: v });
  },
}));

let hydrated = false;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(ac: AudioContext, opts: { freq: number; to?: number; type?: OscillatorType; start: number; dur: number; gain?: number }) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, ac.currentTime + opts.start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, ac.currentTime + opts.start + opts.dur);
  const peak = opts.gain ?? 0.08;
  g.gain.setValueAtTime(0.0001, ac.currentTime + opts.start);
  g.gain.exponentialRampToValueAtTime(peak, ac.currentTime + opts.start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + opts.start + opts.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + opts.start);
  osc.stop(ac.currentTime + opts.start + opts.dur + 0.02);
}

function playSound(name: SoundName) {
  const ac = getCtx();
  if (!ac) return;
  switch (name) {
    case 'click':
      tone(ac, { freq: 600, type: 'triangle', start: 0, dur: 0.05, gain: 0.04 });
      break;
    case 'tick':
      tone(ac, { freq: 1200, type: 'square', start: 0, dur: 0.025, gain: 0.02 });
      break;
    case 'spin':
      tone(ac, { freq: 220, to: 660, type: 'sawtooth', start: 0, dur: 0.35, gain: 0.04 });
      break;
    case 'win':
      [523, 659, 784].forEach((f, i) => tone(ac, { freq: f, type: 'triangle', start: i * 0.09, dur: 0.18, gain: 0.07 }));
      break;
    case 'bigwin':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, { freq: f, type: 'triangle', start: i * 0.1, dur: 0.3, gain: 0.08 }));
      tone(ac, { freq: 1568, type: 'sine', start: 0.55, dur: 0.6, gain: 0.06 });
      break;
    case 'lose':
      tone(ac, { freq: 300, to: 150, type: 'sine', start: 0, dur: 0.3, gain: 0.05 });
      break;
    case 'cashout':
      tone(ac, { freq: 880, type: 'triangle', start: 0, dur: 0.1, gain: 0.07 });
      tone(ac, { freq: 1320, type: 'triangle', start: 0.1, dur: 0.18, gain: 0.07 });
      break;
    case 'crash':
      tone(ac, { freq: 200, to: 60, type: 'sawtooth', start: 0, dur: 0.45, gain: 0.06 });
      break;
  }
}

export function useSound() {
  const profileEnabled = useAuthStore((s) => s.user?.profile.soundEnabled ?? true);
  const localEnabled = useSoundStore((s) => s.localEnabled);
  const setLocalEnabled = useSoundStore((s) => s.setLocalEnabled);

  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    const stored = readStored();
    if (stored !== useSoundStore.getState().localEnabled) useSoundStore.setState({ localEnabled: stored });
  }, []);

  const enabled = profileEnabled && localEnabled;
  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      try {
        playSound(name);
      } catch {
        /* audio is best-effort */
      }
    },
    [enabled],
  );
  const toggle = useCallback(() => setLocalEnabled(!localEnabled), [localEnabled, setLocalEnabled]);

  return useMemo(() => ({ play, enabled, profileEnabled, localEnabled, toggle, setEnabled: setLocalEnabled }), [play, enabled, profileEnabled, localEnabled, toggle, setLocalEnabled]);
}
