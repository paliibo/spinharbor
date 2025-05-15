'use client';
import type { GameEngine } from '@spinharbor/contracts';
import { ArrowRight, Play, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { GameArtworkVisual } from '@/components/game/game-artwork';
import { GameGrid } from '@/components/game/game-carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useGame, useGames } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';

export interface EngineLandingConfig {
  engine: GameEngine;
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  categorySlug: string;
  categoryTitle: string;
  steps: { icon: LucideIcon; title: string; text: string }[];
  facts: { label: string; value: string }[];
}

export function EngineLanding({ config }: { config: EngineLandingConfig }) {
  const game = useGame(config.slug);
  const others = useGames({ category: config.categorySlug, pageSize: 24, sort: 'featured' });
  const otherGames = others.data?.items.filter((g) => g.slug !== config.slug);
  const g = game.data;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.intro} />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface" aria-label={`${config.title} hero`}>
        {game.isLoading ? (
          <Skeleton className="h-[360px] w-full rounded-none" />
        ) : game.isError || !g ? (
          <div className="p-6">
            <EmptyState title="This original is unavailable" description={game.error ? errorMessage(game.error) : 'The game could not be loaded.'} />
          </div>
        ) : (
          <>
            <div className="absolute inset-0">
              <GameArtworkVisual art={g.artwork} size="lg" className="opacity-90" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,11,16,0.95)_0%,rgba(11,11,16,0.85)_45%,rgba(11,11,16,0.35)_100%)]" />
            </div>
            <div className="relative grid gap-6 p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr]">
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="gold">Original</Badge>
                  {g.rtpLabel && <Badge variant="outline">RTP {g.rtpLabel}</Badge>}
                  <Badge variant={g.volatility === 'HIGH' ? 'danger' : g.volatility === 'MEDIUM' ? 'warning' : 'cyan'}>{g.volatility.toLowerCase()} volatility</Badge>
                  {g.status !== 'ACTIVE' && <Badge variant="warning">{g.status.replace('_', ' ').toLowerCase()}</Badge>}
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{g.name}</h2>
                {g.tagline && <p className="mt-1 text-base text-violet">{g.tagline}</p>}
                <p className="mt-3 max-w-xl text-sm text-muted">{g.description}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Min bet', value: credits(g.minBetMinor) },
                    { label: 'Max bet', value: credits(g.maxBetMinor) },
                    { label: 'Rounds 24h', value: g.stats.rounds24h.toLocaleString() },
                    { label: 'Biggest win 24h', value: credits(g.stats.biggestWinMinor) },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border border-border/80 bg-bg/60 px-3 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
                      <dd className="text-sm font-bold tabular">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button size="xl" variant="gold" asChild>
                    <Link href={`/casino/games/${g.slug}`} data-testid="play-now">
                      <Play className="fill-current" /> Play now
                    </Link>
                  </Button>
                  <Button size="xl" variant="outline" asChild>
                    <Link href={`/casino?category=${config.categorySlug}`}>
                      All {config.categoryTitle.toLowerCase()} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.1 }} className="hidden lg:flex lg:items-center lg:justify-end">
                <div className="aspect-[3/4] w-56 overflow-hidden rounded-xl border border-border/70 shadow-glow">
                  <GameArtworkVisual art={g.artwork} size="lg" />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </section>

      <section aria-label="How it works">
        <h2 className="mb-3 text-lg font-bold tracking-tight">How it works</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {config.steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.07 }} className="card-surface p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple/15 text-violet">
                <s.icon className="size-5" />
              </div>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {config.facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-border bg-surface px-4 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
              <dd className="mt-0.5 text-sm font-bold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label={`More ${config.categoryTitle}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">More {config.categoryTitle.toLowerCase()}</h2>
          <Link href={`/casino?category=${config.categorySlug}`} className="text-sm font-medium text-muted hover:text-text">
            View all →
          </Link>
        </div>
        {others.isError ? (
          <EmptyState title="Could not load games" description={errorMessage(others.error)} />
        ) : !others.isLoading && (otherGames?.length ?? 0) === 0 ? (
          <EmptyState title="Nothing else in this category yet" description="The original above is the only entry so far." />
        ) : (
          <GameGrid games={otherGames} loading={others.isLoading} />
        )}
      </section>
    </div>
  );
}
