'use client';
import type { BonusEligibilityDto, PlayerBonusDto } from '@spinharbor/contracts';
import { Gift, Lock, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useClaimBonus } from '@/features/bonuses/use-bonuses';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';
import { timeUntil } from './time-until';

const TYPE_LABEL: Record<BonusEligibilityDto['definition']['type'], string> = { WELCOME: 'Welcome', DAILY_REWARD: 'Daily', CASHBACK: 'Cashback', LOYALTY_MILESTONE: 'Milestone' };

export function BonusEligibilityCard({ item }: { item: BonusEligibilityDto }) {
  const claim = useClaimBonus();
  const d = item.definition;
  const amount = item.previewAmountMinor ?? d.amountMinor;
  const onClaim = () =>
    claim
      .mutateAsync(d.code)
      .then((r) => toast.success(`${d.name} claimed`, { description: `${credits(r.bonus.amountMinor)} credits added to your ${d.wageringMultiplier > 0 ? 'bonus' : 'cash'} balance.` }))
      .catch((e) => toast.error('Claim failed', { description: errorMessage(e) }));
  return (
    <article className={cn('card-surface flex flex-col gap-3 p-5', item.eligible && 'border-gold/40')} data-testid={`bonus-${d.code}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-10 items-center justify-center rounded-lg', item.eligible ? 'bg-gold/15 text-gold-2' : 'bg-surface-3 text-muted')}>{item.eligible ? <Gift className="size-5" /> : <Lock className="size-5" />}</div>
          <div>
            <p className="font-bold leading-tight">{d.name}</p>
            <p className="text-xs text-muted-2">{d.code}</p>
          </div>
        </div>
        <Badge variant={item.eligible ? 'gold' : 'default'}>{TYPE_LABEL[d.type]}</Badge>
      </div>
      <p className="text-sm text-muted">{d.description}</p>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-border bg-surface px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Award</dt>
          <dd className="font-semibold tabular text-gold-2">{d.percentBp && !item.previewAmountMinor ? `${d.percentBp / 100}%` : credits(amount)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Wagering</dt>
          <dd className="font-semibold tabular">{d.wageringMultiplier > 0 ? `${d.wageringMultiplier}×` : 'None'}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted">Valid</dt>
          <dd className="font-semibold tabular">{d.validForHours >= 24 ? `${Math.round(d.validForHours / 24)}d` : `${d.validForHours}h`}</dd>
        </div>
      </dl>
      <div className="mt-auto">
        <Button variant={item.eligible ? 'gold' : 'secondary'} className="w-full" disabled={!item.eligible} loading={claim.isPending} onClick={onClaim} data-testid={`claim-${d.code}`}>
          {item.eligible ? (
            <>
              <Gift /> Claim {credits(amount)}
            </>
          ) : item.nextClaimAt ? (
            <>
              <Timer /> Available {timeUntil(item.nextClaimAt)}
            </>
          ) : (
            'Not eligible'
          )}
        </Button>
        {!item.eligible && item.reason && <p className="mt-1.5 text-center text-xs text-muted-2">{item.reason}{item.nextClaimAt ? ` · ${formatDate(item.nextClaimAt)}` : ''}</p>}
      </div>
    </article>
  );
}

export function ActiveBonusCard({ bonus }: { bonus: PlayerBonusDto }) {
  const pct = bonus.wageringRequiredMinor > 0 ? Math.min(100, Math.round((bonus.wageringProgressMinor / bonus.wageringRequiredMinor) * 100)) : 100;
  return (
    <article className="card-surface p-5" data-testid={`active-bonus-${bonus.definition.code}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{bonus.definition.name}</p>
          <p className="text-xs text-muted">Claimed {formatDate(bonus.claimedAt)} · expires {formatDate(bonus.expiresAt)}</p>
        </div>
        <Badge variant={statusVariant(bonus.status)}>{bonus.status.toLowerCase()}</Badge>
      </div>
      <p className="mt-3 text-2xl font-bold tabular text-violet">{credits(bonus.amountMinor)}</p>
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>Wagering progress</span>
          <span className="tabular">
            {credits(bonus.wageringProgressMinor)} / {credits(bonus.wageringRequiredMinor)} ({pct}%)
          </span>
        </div>
        <Progress value={pct} />
        <p className="mt-1.5 text-[11px] text-muted-2">{pct >= 100 ? 'Requirement met – funds release to cash on the next settlement.' : `Wager ${credits(bonus.wageringRequiredMinor - bonus.wageringProgressMinor)} more to release the bonus to your cash balance.`}</p>
      </div>
    </article>
  );
}

export function BonusHistoryTable({ items }: { items: PlayerBonusDto[] }) {
  return (
    <Table data-testid="bonus-history">
      <THead>
        <TR>
          <TH>Bonus</TH>
          <TH>Status</TH>
          <TH className="text-right">Amount</TH>
          <TH className="text-right">Wagered</TH>
          <TH>Claimed</TH>
          <TH>Completed / expires</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((b) => (
          <TR key={b.id}>
            <TD>
              <p className="font-medium">{b.definition.name}</p>
              <p className="text-xs text-muted-2">{b.definition.code}</p>
            </TD>
            <TD>
              <Badge variant={statusVariant(b.status)}>{b.status.toLowerCase()}</Badge>
            </TD>
            <TD className="text-right tabular font-semibold">{credits(b.amountMinor)}</TD>
            <TD className="text-right tabular text-muted">{b.wageringRequiredMinor > 0 ? `${credits(b.wageringProgressMinor)} / ${credits(b.wageringRequiredMinor)}` : '—'}</TD>
            <TD className="whitespace-nowrap text-muted">{formatDate(b.claimedAt)}</TD>
            <TD className="whitespace-nowrap text-muted">{b.completedAt ? formatDate(b.completedAt) : formatDate(b.expiresAt)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
