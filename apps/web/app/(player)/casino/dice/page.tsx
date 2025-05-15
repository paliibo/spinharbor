'use client';
import { Crosshair, Percent, Server } from 'lucide-react';
import { EngineLanding, type EngineLandingConfig } from '@/components/player/engine-landing';

const config: EngineLandingConfig = {
  engine: 'DICE',
  slug: 'harbor-dice',
  eyebrow: 'Instant win',
  title: 'Harbor Dice & instant games',
  intro: 'Pick a target, choose over or under, roll. The simplest game in the harbor and the most transparent: 99% return on every roll.',
  categorySlug: 'instant',
  categoryTitle: 'Instant games',
  steps: [
    { icon: Crosshair, title: 'Set a target', text: 'Slide the target anywhere from 1.00 to 99.00 and pick OVER or UNDER. The win chance and multiplier update instantly.' },
    { icon: Server, title: 'Roll on the server', text: 'A number from 0.00 to 100.00 is drawn from a seeded RNG. The seed hash is returned with every round for verification.' },
    { icon: Percent, title: 'Win = chance × 99%', text: 'The payout multiplier is 99 ÷ win-chance, so a 50% roll pays 1.98× and a 10% roll pays 9.90×.' },
  ],
  facts: [
    { label: 'Return to player', value: '99.0%' },
    { label: 'House edge', value: '1.0%' },
    { label: 'Target range', value: '1.00 – 99.00' },
    { label: 'Directions', value: 'Roll over · roll under' },
  ],
};

export default function DicePage() {
  return <EngineLanding config={config} />;
}
