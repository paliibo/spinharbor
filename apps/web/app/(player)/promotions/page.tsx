'use client';
import { Megaphone } from 'lucide-react';
import { PromoCard, PromoCardSkeleton } from '@/components/promo/promo-card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { usePromotions } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

export default function PromotionsPage() {
  const promotions = usePromotions();
  const items = promotions.data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Rewards" title="Promotions" description="Bonuses, cashback and feature launches. Everything is paid in demo credits and tracked in the same ledger as your gameplay." />
      {promotions.isError ? (
        <EmptyState title="Could not load promotions" description={errorMessage(promotions.error)} />
      ) : !promotions.isLoading && items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No promotions right now" description="Check back soon – daily rewards and cashback run on a schedule." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promotions.isLoading && Array.from({ length: 6 }).map((_, i) => <PromoCardSkeleton key={i} />)}
          {items.map((p, i) => (
            <PromoCard key={p.id} promo={p} index={i} />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-2">Bonus credits carry a wagering requirement before they are released to cash. Claims count towards your daily top-up limit under Responsible gaming.</p>
    </div>
  );
}
