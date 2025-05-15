'use client';
import { Hash, Rocket, Users } from 'lucide-react';
import { EngineLanding, type EngineLandingConfig } from '@/components/player/engine-landing';

const config: EngineLandingConfig = {
  engine: 'CRASH',
  slug: 'harbor-crash',
  eyebrow: 'Crash',
  title: 'Harbor Crash',
  intro: 'A shared multiplayer round every few seconds: the multiplier climbs, you cash out before it crashes – or you don’t.',
  categorySlug: 'crash',
  categoryTitle: 'Crash games',
  steps: [
    { icon: Hash, title: 'Provably fair seed', text: 'Before each round the server publishes the SHA-256 hash of its seed. After the crash the seed is revealed so the result can be recomputed.' },
    { icon: Users, title: 'Everyone bets together', text: 'Bets are accepted during the countdown. Live bets, cash-outs and the rising multiplier stream to every player over Socket.IO.' },
    { icon: Rocket, title: 'Cash out in time', text: 'Hit cash out while the multiplier is climbing to lock in stake × multiplier. If the round crashes first, the stake is lost.' },
  ],
  facts: [
    { label: 'Fairness', value: 'Seed hash published pre-round' },
    { label: 'Round cadence', value: 'Continuous, shared' },
    { label: 'Auto cash-out', value: 'Optional target multiplier' },
    { label: 'Max multiplier', value: 'Uncapped (edge-weighted)' },
  ],
};

export default function CrashPage() {
  return <EngineLanding config={config} />;
}
