'use client';
import type { LoyaltyStatusDto } from '@spinharbor/contracts';
import { Check, Crown, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { tierTone } from '@/features/loyalty/use-loyalty';
import { cn, formatDate } from '@/lib/utils';

export function LoyaltyTierCard({ data }: { data: LoyaltyStatusDto }) {
  const tone = tierTone[data.tier];
  const next = data.nextTier ? tierTone[data.nextTier] : null;
  const nextDef = data.tiers.find((t) => t.tier === data.nextTier);
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card-surface relative overflow-hidden p-6" data-testid="loyalty-tier-card">
      <div className={cn('pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl', tone.bg)} />
      <div className="relative grid gap-6 md:grid-cols-[auto_1fr]">
        <div className={cn('flex size-24 items-center justify-center rounded-2xl border-2', tone.ring, tone.bg, tone.text)}>
          <Crown className="size-12" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Current tier</p>
          <h2 className={cn('text-3xl font-extrabold tracking-tight', tone.text)}>{tone.label}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Points balance</p>
              <p className="text-xl font-bold tabular">{data.points.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Lifetime points</p>
              <p className="text-xl font-bold tabular">{data.lifetimePoints.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">To next tier</p>
              <p className="text-xl font-bold tabular">{next ? data.pointsToNextTier.toLocaleString() : '—'}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>{next ? `Progress to ${next.label}` : 'Top tier reached'}</span>
              <span className="tabular">{data.progressPercent}%</span>
            </div>
            <Progress value={data.progressPercent} indicatorClassName="from-gold to-gold-2" />
            {nextDef && <p className="mt-1.5 text-[11px] text-muted-2">{next!.label} unlocks at {nextDef.minLifetimePoints.toLocaleString()} lifetime points.</p>}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export function TierLadder({ data }: { data: LoyaltyStatusDto }) {
  const currentIdx = data.tiers.findIndex((t) => t.tier === data.tier);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="tier-ladder">
      {data.tiers.map((t, i) => {
        const tone = tierTone[t.tier];
        const reached = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <motion.div key={t.tier} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.06 }} className={cn('card-surface flex flex-col gap-3 p-5', current && cn('border-2', tone.ring), !reached && 'opacity-80')}>
            <div className="flex items-center justify-between">
              <p className={cn('text-lg font-bold', tone.text)}>{tone.label}</p>
              {current ? <Badge className={cn(tone.ring, tone.bg, tone.text)}>Current</Badge> : reached ? <Badge variant="success">Reached</Badge> : <Badge>{t.minLifetimePoints.toLocaleString()} pts</Badge>}
            </div>
            <p className="text-xs text-muted">From {t.minLifetimePoints.toLocaleString()} lifetime points</p>
            <ul className="space-y-1.5 text-sm">
              {t.perks.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check className={cn('mt-0.5 size-4 shrink-0', reached ? 'text-success' : 'text-muted-2')} /> <span className={reached ? '' : 'text-muted'}>{p}</span>
                </li>
              ))}
              {t.milestoneBonusCode && (
                <li className="flex items-start gap-2 text-gold-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0" /> Milestone bonus on arrival
                </li>
              )}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
}

export function PointsHistory({ items }: { items: LoyaltyStatusDto['recent'] }) {
  return (
    <Table data-testid="points-history">
      <THead>
        <TR>
          <TH>When</TH>
          <TH>Reason</TH>
          <TH className="text-right">Points</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((e) => (
          <TR key={e.id}>
            <TD className="whitespace-nowrap text-muted">{formatDate(e.createdAt)}</TD>
            <TD>{e.reason}</TD>
            <TD className={cn('text-right tabular font-semibold', e.points >= 0 ? 'text-success' : 'text-danger')}>
              {e.points >= 0 ? '+' : ''}
              {e.points.toLocaleString()}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
