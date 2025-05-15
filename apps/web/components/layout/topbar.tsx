'use client';
import { Bell, ChevronDown, Coins, LogOut, Menu, RefreshCw, Search, Settings, Shield, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isStaff, useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-auth';
import { useResetWallet, useWallet } from '@/features/wallet/use-wallet';
import { credits } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Brand } from './brand';

export function BalancePill({ className }: { className?: string }) {
  const wallet = useWallet();
  const reset = useResetWallet();
  if (wallet.isLoading) return <Skeleton className={cn('h-9 w-32', className)} />;
  if (!wallet.data) return null;
  return (
    <div className={cn('flex items-center gap-1 rounded-full border border-border bg-surface pl-3 pr-1', className)} data-testid="balance-pill">
      <Coins className="size-4 text-gold" />
      <span className="text-sm font-bold tabular" data-testid="balance-value">
        {credits(wallet.data.balanceMinor)}
      </span>
      {wallet.data.bonusBalanceMinor > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded-full bg-violet/15 px-1.5 text-[10px] font-semibold text-violet tabular">+{credits(wallet.data.bonusBalanceMinor, { compact: true })}</span>
          </TooltipTrigger>
          <TooltipContent>Bonus balance (wagering required)</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label="Reset demo balance" loading={reset.isPending} onClick={() => reset.mutateAsync().then(() => toast.success('Demo balance restored to 10,000.00')).catch((e) => toast.error(errorMessage(e)))}>
            <RefreshCw />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset demo balance to 10,000</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const router = useRouter();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2 hover:bg-surface-3 focus-ring" data-testid="user-menu">
          <Avatar seed={user.profile.avatarSeed} name={user.profile.displayName} size={28} />
          <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{user.profile.displayName}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between normal-case tracking-normal">
          <span className="truncate text-sm text-text">{user.username}</span>
          <Badge variant={user.role === 'PLAYER' ? 'purple' : 'gold'}>{user.loyalty.tier}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wallet">
            <Wallet /> Wallet & transactions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/responsible-gaming">
            <Shield /> Responsible gaming
          </Link>
        </DropdownMenuItem>
        {isStaff(user) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield /> Operator dashboard
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            // mutateAsync resolves after the session cookie is cleared; the cache reset inside the hook
            // would drop a per-call callback, so navigate here instead.
            await logout.mutateAsync().catch(() => undefined);
            router.replace('/login');
          }}
          data-testid="logout"
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <Brand className="lg:hidden" compact />
      <form
        className="relative hidden flex-1 md:block md:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/casino?search=${encodeURIComponent(q)}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games or providers…" className="h-10 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-sm placeholder:text-muted-2 focus-ring" data-testid="search-input" />
      </form>
      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <>
            <BalancePill className="hidden sm:flex" />
            <Link href="/casino/dice" className="hidden md:block">
              <Button variant="gold" size="sm">
                Play now
              </Button>
            </Link>
            <NotificationsButton />
            <UserMenu />
          </>
        ) : status === 'ready' ? (
          <>
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="gold" asChild>
              <Link href="/register">Join free</Link>
            </Button>
          </>
        ) : (
          <Skeleton className="h-9 w-40" />
        )}
      </div>
    </header>
  );
}

function NotificationsButton() {
  return (
    <Button variant="ghost" size="icon" asChild aria-label="Notifications">
      <Link href="/profile#notifications">
        <Bell />
      </Link>
    </Button>
  );
}
