'use client';
import { ArrowLeft, Menu, Radio } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Brand } from '@/components/layout/brand';
import { adminNav } from '@/components/layout/nav-config';
import { NavLink } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/topbar';
import { useAuthStore } from '@/features/auth/auth-store';
import { RoleBadge } from './shared';

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4" data-testid="admin-sidebar">
      <div className="flex items-center justify-between px-2">
        <Brand href="/admin" />
        <Badge variant="purple" className="text-[9px]">
          Ops
        </Badge>
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Operations">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-2">Operations</p>
        {adminNav.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-text focus-ring" data-testid="admin-back-to-casino">
          <ArrowLeft className="size-4" /> Back to casino
        </Link>
        {user && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.profile.displayName}</p>
                <p className="truncate text-[11px] text-muted-2">{user.email}</p>
              </div>
              <RoleBadge role={user.role} />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-2">
              {user.role === 'ADMIN' ? 'Full access incl. wallet adjustments and settings.' : user.role === 'OPERATOR' ? 'Can change statuses, catalogue, bonuses and risk flags.' : 'Read-only access.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function pageTitle(pathname: string) {
  const match = [...adminNav].sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === '/admin' ? pathname === '/admin' : pathname === n.href || pathname.startsWith(n.href + '/')));
  if (!match) return 'Operations';
  const rest = pathname.slice(match.href.length).split('/').filter(Boolean);
  return rest.length ? `${match.label} · detail` : match.label;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface/40 lg:block">
        <AdminSidebar />
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r border-border p-0 data-[state=open]:animate-none" hideClose>
          <DialogTitle className="sr-only">Admin navigation</DialogTitle>
          <AdminSidebar onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur lg:px-6" data-testid="admin-topbar">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu">
            <Menu />
          </Button>
          <Brand href="/admin" className="lg:hidden" compact />
          <div className="min-w-0">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-violet sm:block">Operator console</p>
            <h2 className="truncate text-sm font-semibold leading-tight" data-testid="admin-page-title">
              {pageTitle(pathname)}
            </h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted md:inline-flex">
              <Radio className="size-3 text-success" /> Demo environment
            </span>
            {user && <RoleBadge role={user.role} />}
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 px-4 pb-16 pt-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
