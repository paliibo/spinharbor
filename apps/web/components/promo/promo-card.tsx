'use client';
import type { PromotionDto } from '@spinharbor/contracts';
import { ArrowRight, CalendarDays, Gift } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/auth-store';
import { useClaimBonus } from '@/features/bonuses/use-bonuses';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';
import { PromoArt } from './promo-art';

/** Where a promotion without a bonus code should send the player. */
export function promoHref(p: PromotionDto): string {
  if (p.bonusCode) return '/bonuses';
  const s = `${p.slug} ${p.title}`.toLowerCase();
  if (s.includes('crash')) return '/casino/crash';
  if (s.includes('loyal') || s.includes('tier')) return '/loyalty';
  if (s.includes('slot') || s.includes('reel')) return '/casino/slots';
  if (s.includes('dice')) return '/casino/dice';
  if (s.includes('roulette')) return '/casino/roulette';
  return '/casino';
}

export function PromoCard({ promo, index = 0, compact = false, className }: { promo: PromotionDto; index?: number; compact?: boolean; className?: string }) {
  const user = useAuthStore((s) => s.user);
  const claim = useClaimBonus();
  const href = promoHref(promo);
  const live = promo.isActive && (!promo.endsAt || new Date(promo.endsAt) > new Date());

  const onClaim = () => {
    if (!promo.bonusCode) return;
    claim
      .mutateAsync(promo.bonusCode)
      .then((r) => toast.success(`${promo.title} claimed`, { description: `${credits(r.bonus.amountMinor)} credits added${r.bonus.wageringRequiredMinor > 0 ? ` · wager ${credits(r.bonus.wageringRequiredMinor)} to release` : ''}.` }))
      .catch((e) => toast.error('Could not claim bonus', { description: errorMessage(e) }));
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3), ease: 'easeOut' }}
      className={cn('group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-violet/50', className)}
      data-testid="promo-card"
      data-slug={promo.slug}
    >
      <div className={cn('relative w-full', compact ? 'h-32' : 'h-40 sm:h-44')}>
        <PromoArt artwork={promo.artwork} />
        <div className="absolute left-3 top-3 flex gap-1">
          {promo.bonusCode ? (
            <Badge variant="gold">
              <Gift className="size-3" /> Bonus
            </Badge>
          ) : (
            <Badge variant="cyan">Feature</Badge>
          )}
          {!live && <Badge variant="warning">Ended</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="text-base font-bold leading-tight">{promo.title}</h3>
          {promo.subtitle && <p className="mt-0.5 text-sm text-violet">{promo.subtitle}</p>}
        </div>
        {!compact && <p className="line-clamp-3 text-sm text-muted">{promo.description}</p>}
        <p className="flex items-center gap-1.5 text-[11px] text-muted-2">
          <CalendarDays className="size-3.5" />
          {promo.endsAt ? `Until ${formatDate(promo.endsAt, { dateStyle: 'medium' })}` : `Since ${formatDate(promo.startsAt, { dateStyle: 'medium' })} · ongoing`}
        </p>
        <div className="mt-auto pt-2">
          {promo.bonusCode && user ? (
            <Button size="sm" variant="gold" className="w-full" loading={claim.isPending} disabled={!live} onClick={onClaim} data-testid={`promo-claim-${promo.bonusCode}`}>
              <Gift /> {promo.ctaLabel}
            </Button>
          ) : (
            <Button size="sm" variant={promo.bonusCode ? 'gold' : 'secondary'} className="w-full" asChild>
              <Link href={promo.bonusCode && !user ? `/login?next=${encodeURIComponent('/bonuses')}` : href}>
                {promo.ctaLabel} <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function PromoCardSkeleton() {
  return <div className="h-80 animate-pulse-soft rounded-xl bg-surface-3" />;
}
