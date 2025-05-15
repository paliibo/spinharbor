'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { isStaff, useAuthStore } from '@/features/auth/auth-store';

/** Client-side guard (UX only). Every protected API call is independently authorised server-side. */
export function RequireAuth({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status !== 'ready') return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (staff && !isStaff(user)) router.replace('/');
  }, [status, user, staff, router, pathname]);
  if (status !== 'ready' || !user || (staff && !isStaff(user))) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
