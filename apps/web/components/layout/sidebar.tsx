'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from './brand';
import { playerAccountNav, playerNav } from './nav-config';
import { cn } from '@/lib/utils';
import { useAuthStore, isStaff } from '@/features/auth/auth-store';
import { LayoutDashboard } from 'lucide-react';

export function NavLink({ href, label, icon: Icon, exact, onClick }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const active = exact || href === '/' || href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  return (
    <Link href={href} onClick={onClick} className={cn('group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring', active ? 'bg-purple/15 text-text shadow-[inset_2px_0_0_0_#9b6bff]' : 'text-muted hover:bg-surface-3 hover:text-text')} aria-current={active ? 'page' : undefined}>
      <Icon className={cn('size-4 shrink-0', active ? 'text-violet' : 'text-muted-2 group-hover:text-muted')} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <Brand className="px-2" />
      <nav className="flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-2">Casino</p>
        {playerNav.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavigate} />
        ))}
      </nav>
      <nav className="flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-2">Account</p>
        {playerAccountNav.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavigate} />
        ))}
      </nav>
      {isStaff(user) && (
        <nav className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-2">Staff</p>
          <NavLink href="/admin" label="Operator dashboard" icon={LayoutDashboard} onClick={onNavigate} />
        </nav>
      )}
      <div className="mt-auto rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted-2">
        <p className="font-semibold text-muted">Demo credits only</p>
        SpinHarbor is a portfolio simulation. No real money is accepted or paid out.
      </div>
    </div>
  );
}
