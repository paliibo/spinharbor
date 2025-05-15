'use client';
import { Clock3, Flame, Sparkles, Star, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { GameCarousel, SectionHeader } from '@/components/game/game-carousel';
import { CategoryChips } from '@/components/player/category-chips';
import { HomeHero } from '@/components/player/home-hero';
import { RewardsCard } from '@/components/player/rewards-card';
import { PromoCard, PromoCardSkeleton } from '@/components/promo/promo-card';
import { EmptyState } from '@/components/ui/misc';
import { useAuthStore } from '@/features/auth/auth-store';
import { useCategories, useHome, usePromotions } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const home = useHome();
  const categories = useCategories();
  const promotions = usePromotions();
  const promos = (promotions.data ?? []).filter((p) => p.isActive).slice(0, 3);

  return (
    <div className="space-y-10">
      <HomeHero featured={home.data?.featured} loading={home.isLoading} />

      <section aria-label="Categories">
        <SectionHeader title="Browse by category" href="/casino" />
        <CategoryChips categories={categories.data} loading={categories.isLoading} />
      </section>

      {home.isError ? (
        <EmptyState title="The lobby is unavailable" description={errorMessage(home.error)} />
      ) : (
        <>
          <GameCarousel title="Featured" icon={<Star />} games={home.data?.featured} loading={home.isLoading} href="/casino?sort=featured" />
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-10">
              <GameCarousel title="Popular right now" icon={<Flame />} games={home.data?.popular} loading={home.isLoading} href="/casino?sort=popular" />
              {user && (home.data?.recent.length ?? 0) > 0 && <GameCarousel title="Recently played" icon={<Clock3 />} games={home.data?.recent} href="/recent" />}
            </div>
            <RewardsCard className="lg:sticky lg:top-24 lg:self-start" />
          </div>
          <GameCarousel title="Recommended for you" icon={<Wand2 />} games={home.data?.recommended} loading={home.isLoading} href="/casino" />
          <GameCarousel title="New releases" icon={<Sparkles />} games={home.data?.newest} loading={home.isLoading} href="/casino?sort=newest" />
        </>
      )}

      <section aria-label="Promotions">
        <SectionHeader title="Promotions" href="/promotions" />
        {promotions.isError ? (
          <EmptyState title="Promotions are unavailable" description={errorMessage(promotions.error)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.isLoading && Array.from({ length: 3 }).map((_, i) => <PromoCardSkeleton key={i} />)}
            {promos.map((p, i) => (
              <PromoCard key={p.id} promo={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
        <p className="font-semibold text-text">How SpinHarbor works</p>
        <p className="mt-1">
          Every round is generated and settled on the server, every credit movement is a double-entry ledger journal, and the balance you see is pushed over a live socket. Read more about limits and cooling-off under{' '}
          <Link href="/responsible-gaming" className="text-violet underline-offset-4 hover:underline">
            Responsible gaming
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
