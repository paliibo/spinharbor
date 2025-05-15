'use client';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/auth-store';
import { formatDate } from '@/lib/utils';

/** Shown whenever the account cannot play. The server enforces the same rule on every round. */
export function RestrictionBanner() {
  const user = useAuthStore((s) => s.user);
  if (!user || user.status === 'ACTIVE') return null;
  const until = user.statusUntil ? ` until ${formatDate(user.statusUntil)}` : '';
  const text =
    user.status === 'SUSPENDED'
      ? 'Your account is suspended. Gameplay is disabled – contact support.'
      : user.status === 'COOLING_OFF'
        ? `You are in a cooling-off period${until}. Gameplay is paused.`
        : user.status === 'SELF_EXCLUDED'
          ? `You are self-excluded${until}. Gameplay is disabled.`
          : 'This account is closed.';
  return (
    <div className="flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning" role="status" data-testid="restriction-banner">
      {user.status === 'SUSPENDED' ? <ShieldAlert className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
      <span className="flex-1">{text}</span>
      <Link href="/responsible-gaming" className="font-semibold underline-offset-4 hover:underline">
        Details
      </Link>
    </div>
  );
}
