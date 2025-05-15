'use client';
import type { GameSummaryDto } from '@spinharbor/contracts';
import { ArrowRight, Play, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { GameArtworkVisual } from '@/components/game/game-artwork';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useAuthStore } from '@/features/auth/auth-store';

const FALLBACK_ART = { palette: ['#6d3df5', '#1b1030', '#d4a84b'] as [string, string, string], motif: 'anchor' as const };

export function HomeHero({ featured, loading }: { featured?: GameSummaryDto[]; loading?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const spotlight = featured?.find((g) => g.playable) ?? featured?.[0];
  const art = spotlight?.artwork ?? FALLBACK_ART;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Welcome">
      <div className="absolute inset-0">
        <GameArtworkVisual art={art} size="lg" className="opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,11,16,0.96)_0%,rgba(11,11,16,0.9)_38%,rgba(11,11,16,0.45)_70%,rgba(11,11,16,0.2)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,11,16,0.9)_0%,transparent_45%)]" />
      </div>
      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:p-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="max-w-xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="gold">
              <Sparkles className="size-3" /> SpinHarbor Originals
            </Badge>
            <Badge variant="outline">
              <ShieldCheck className="size-3" /> Server-side outcomes
            </Badge>
          </div>
          <h1 className="text-balance text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Set sail with <span className="gold-text">10,000</span> demo credits.
          </h1>
          <p className="mt-4 max-w-lg text-balance text-sm text-muted sm:text-base">
            Four in-house games, a double-entry ledger and live multiplayer crash rounds – a complete casino platform built as a portfolio showcase. No deposits, no withdrawals, nothing to lose but time.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {status !== 'ready' ? (
              <Skeleton className="h-12 w-48" />
            ) : user ? (
              <>
                <Button size="lg" variant="gold" asChild>
                  <Link href={spotlight ? `/casino/games/${spotlight.slug}` : '/casino'} data-testid="hero-play">
                    <Play className="fill-current" /> {spotlight ? `Play ${spotlight.name}` : 'Play now'}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/casino">
                    Browse lobby <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" variant="gold" asChild>
                  <Link href="/register" data-testid="hero-join">
                    Join free <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/casino">Browse lobby</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-5 text-[11px] text-muted-2">Demo credits only · virtual balance with no monetary value · not a licensed gambling operator.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }} className="hidden lg:flex lg:items-end lg:justify-end">
          {loading ? (
            <Skeleton className="h-64 w-48 rounded-xl" />
          ) : spotlight ? (
            <Link href={`/casino/games/${spotlight.slug}`} className="group relative block w-52 overflow-hidden rounded-xl border border-border/80 shadow-glow transition-transform hover:-translate-y-1 focus-ring" aria-label={`Open ${spotlight.name}`}>
              <div className="aspect-[3/4] w-full">
                <GameArtworkVisual art={spotlight.artwork} size="lg" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-2">Spotlight</p>
                <p className="truncate text-base font-bold">{spotlight.name}</p>
                <p className="truncate text-xs text-muted">{spotlight.tagline ?? spotlight.provider.name}</p>
              </div>
            </Link>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
