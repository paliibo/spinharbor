'use client';
import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sidebar } from './sidebar';
import { BalancePill, Topbar } from './topbar';
import { useAuthStore } from '@/features/auth/auth-store';
import { RestrictionBanner } from './restriction-banner';
import { MobileNav } from './mobile-nav';

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface/40 lg:block">
        <Sidebar />
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r border-border p-0 data-[state=open]:animate-none" hideClose>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <Sidebar onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        {user && (
          <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2 sm:hidden">
            <span className="text-xs text-muted">Balance</span>
            <BalancePill />
          </div>
        )}
        <RestrictionBanner />
        <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-24 pt-6 lg:px-8 lg:pb-10">{children}</main>
        <footer className="hidden border-t border-border px-8 py-6 text-xs text-muted-2 lg:block">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} SpinHarbor · Portfolio demo · Not a licensed gambling operator · Demo credits have no monetary value.</span>
            <span>Backend-authoritative outcomes · Double-entry ledger · Socket.IO realtime</span>
          </div>
        </footer>
        <MobileNav />
      </div>
    </div>
  );
}
