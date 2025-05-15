'use client';
import { CircleDot, Layers, Server } from 'lucide-react';
import { EngineLanding, type EngineLandingConfig } from '@/components/player/engine-landing';

const config: EngineLandingConfig = {
  engine: 'ROULETTE',
  slug: 'harbor-roulette',
  eyebrow: 'Table games',
  title: 'Harbor Roulette & table games',
  intro: 'European single-zero roulette with the full betting layout: straights, splits, dozens, columns and even-money outside bets.',
  categorySlug: 'table-games',
  categoryTitle: 'Table games',
  steps: [
    { icon: Layers, title: 'Build your bets', text: 'Place chips on numbers, dozens, columns, red/black, odd/even or high/low. Several bets can ride on one spin.' },
    { icon: Server, title: 'The wheel spins server-side', text: 'A single number from 0–36 is drawn from a seeded RNG; each bet is resolved against the standard European paytable.' },
    { icon: CircleDot, title: 'Collect', text: 'Winning bets pay from 1:1 on outside bets up to 35:1 on a straight number. Everything settles in one ledger journal.' },
  ],
  facts: [
    { label: 'Wheel', value: 'European · single zero' },
    { label: 'House edge', value: '2.70%' },
    { label: 'Straight payout', value: '35 to 1' },
    { label: 'Outside bets', value: 'Red/black · odd/even · dozens' },
  ],
};

export default function RoulettePage() {
  return <EngineLanding config={config} />;
}
