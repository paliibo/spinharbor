'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Gift, Home, Rocket, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/casino', label: 'Casino', icon: Compass },
  { href: '/casino/crash', label: 'Crash', icon: Rocket },
  { href: '/promotions', label: 'Promos', icon: Gift },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur lg:hidden" aria-label="Mobile navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={cn('flex flex-col items-center gap-1 py-2 text-[10px] font-medium', active ? 'text-violet' : 'text-muted')}>
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
