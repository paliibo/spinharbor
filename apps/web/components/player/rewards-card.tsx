'use client';
import { ArrowRight, Coins, Gift, Trophy, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useAuthStore } from '@/features/auth/auth-store';
import { useBonuses } from '@/features/bonuses/use-bonuses';
import { tierTone, useLoyalty } from '@/features/loyalty/use-loyalty';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';
import { timeUntil } from './time-until';

/** Logged-in: balance + loyalty + next bonus. Logged-out: the "join free" pitch. */
export function RewardsCard({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  if (status !== 'ready') return <Skeleton className={cn('h-64 w-full rounded-xl', className)} />;
  if (!user) return <JoinCard className={className} />;
  return <PlayerRewards className={className} />;
}

function PlayerRewards({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)!;
  const wallet = useWallet();
  const loyalty = useLoyalty();
  const bonuses = useBonuses();
  const next = bonuses.data?.find((b) => b.eligible) ?? bonuses.data?.slice().sort((a, b) => (a.nextClaimAt ?? '9').localeCompare(b.nextClaimAt ?? '9'))[0];
  const tier = loyalty.data?.tier ?? user.loyalty.tier;
  const tone = tierTone[tier];

  return (
    <section className={cn('card-surface flex flex-col gap-4 p-5', className)} data-testid="rewards-card" aria-label="Player rewards summary">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Your rewards</h2>
        <Badge className={cn('border', tone.ring, tone.bg, tone.text)}>{tone.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            <Coins className="size-3.5 text-gold" /> Balance
          </p>
          {wallet.isLoading ? <Skeleton className="mt-1 h-7 w-24" /> : <p className="mt-1 text-xl font-bold tabular">{credits(wallet.data?.balanceMinor)}</p>}
          {wallet.data && wallet.data.bonusBalanceMinor > 0 && <p className="text-[11px] text-violet tabular">+{credits(wallet.data.bonusBalanceMinor)} bonus</p>}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            <Trophy className="size-3.5 text-violet" /> Points
          </p>
          {loyalty.isLoading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="mt-1 text-xl font-bold tabular">{(loyalty.data?.points ?? user.loyalty.points).toLocaleString()}</p>}
          <p className="text-[11px] text-muted-2">{loyalty.data?.nextTier ? `${loyalty.data.pointsToNextTier.toLocaleString()} to ${tierTone[loyalty.data.nextTier].label}` : 'Top tier reached'}</p>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[11px] text-muted">
          <span>Tier progress</span>
          <span className="tabular">{loyalty.data?.progressPercent ?? 0}%</span>
        </div>
        <Progress value={loyalty.data?.progressPercent ?? 0} indicatorClassName="from-gold to-gold-2" />
      </div>
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          <Gift className="size-3.5 text-gold" /> Next bonus
        </p>
        {bonuses.isLoading ? (
          <Skeleton className="mt-1 h-5 w-40" />
        ) : next ? (
          <>
            <p className="mt-1 text-sm font-semibold">{next.definition.name}</p>
            <p className="text-xs text-muted">{next.eligible ? `Claimable now · ${credits(next.previewAmountMinor ?? next.definition.amountMinor)} credits` : next.nextClaimAt ? `Available ${timeUntil(next.nextClaimAt)}` : (next.reason ?? 'Not eligible yet')}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">No bonuses available right now.</p>
        )}
      </div>
      <Button variant={next?.eligible ? 'gold' : 'secondary'} asChild>
        <Link href="/bonuses">
          {next?.eligible ? 'Claim bonus' : 'View bonuses'} <ArrowRight />
        </Link>
      </Button>
    </section>
  );
}

function JoinCard({ className }: { className?: string }) {
  return (
    <section className={cn('relative overflow-hidden rounded-xl border border-gold/30 bg-surface p-5', className)} data-testid="join-card">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-purple/20 blur-3xl" />
      <div className="relative">
        <Badge variant="gold">
          <UserPlus className="size-3" /> New players
        </Badge>
        <h2 className="mt-3 text-2xl font-extrabold leading-tight">
          Join free – <span className="gold-text">10,000</span> demo credits
        </h2>
        <p className="mt-2 text-sm text-muted">Create an account in seconds. Your balance is virtual, resets on demand and unlocks every original game, bonus and loyalty tier.</p>
        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          {['Welcome bonus of 2,000 bonus credits', 'Daily reward every 24 hours', 'Loyalty points on every wager'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-gold" /> {t}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex gap-2">
          <Button variant="gold" className="flex-1" asChild>
            <Link href="/register">Create account</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
