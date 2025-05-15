'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useMe } from '@/features/auth/use-auth';
import { useAuthStore } from '@/features/auth/auth-store';
import { getSocket } from '@/lib/socket';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { ApiRequestError } from '@/lib/api';

function SessionBootstrap({ children }: { children: ReactNode }) {
  useMe();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  // Account-level realtime events: status changes (suspension / self-exclusion) and reminders.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const onStatus = (p: { status: string; reason: string | null }) => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.rg });
      if (p.status !== 'ACTIVE') toast.warning(`Account status changed to ${p.status.replace('_', ' ').toLowerCase()}`, { description: p.reason ?? undefined, duration: 8000 });
    };
    const onReminder = (p: { minutesPlayed: number }) => toast.info(`You have been playing for ${p.minutesPlayed} minutes`, { description: 'Consider taking a break. Limits are available under Responsible gaming.', duration: 10_000 });
    socket.on('account:status', onStatus);
    socket.on('session:reminder', onReminder);
    return () => {
      socket.off('account:status', onStatus);
      socket.off('session:reminder', onReminder);
    };
  }, [user, qc]);
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: (count, err) => !(err instanceof ApiRequestError && err.status < 500) && count < 2 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        <SessionBootstrap>{children}</SessionBootstrap>
      </TooltipProvider>
      <Toaster theme="dark" position="bottom-right" richColors closeButton toastOptions={{ style: { background: '#1a1a25', border: '1px solid #272736', color: '#f2f1f7' } }} />
    </QueryClientProvider>
  );
}
