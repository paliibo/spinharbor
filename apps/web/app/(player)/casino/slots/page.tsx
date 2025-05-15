'use client';
import { Coins, LayoutGrid, Server } from 'lucide-react';
import { EngineLanding, type EngineLandingConfig } from '@/components/player/engine-landing';

const config: EngineLandingConfig = {
  engine: 'SLOTS',
  slug: 'harbor-reels',
  eyebrow: 'Slots',
  title: 'Harbor Reels & slots',
  intro: 'The flagship SpinHarbor original: five reels, three rows and ten fixed paylines with wild anchors and star scatters.',
  categorySlug: 'slots',
  categoryTitle: 'Slots',
  steps: [
    { icon: Coins, title: 'Pick a bet', text: 'Choose a stake between the game minimum and maximum. The bet is split across all 10 paylines.' },
    { icon: Server, title: 'Spin on the server', text: 'The server draws the 5×3 grid from a seeded RNG, evaluates every payline and commits the stake and win in one ledger transaction.' },
    { icon: LayoutGrid, title: 'Watch it land', text: 'The client only animates the result it receives – wins, wilds and scatters are highlighted line by line.' },
  ],
  facts: [
    { label: 'Layout', value: '5 reels × 3 rows' },
    { label: 'Paylines', value: '10 fixed' },
    { label: 'Simulated RTP', value: '≈95.7% (Monte Carlo)' },
    { label: 'Specials', value: 'Wild anchor · star scatter' },
  ],
};

export default function SlotsPage() {
  return <EngineLanding config={config} />;
}
