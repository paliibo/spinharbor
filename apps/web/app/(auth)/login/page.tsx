'use client';
import { Suspense } from 'react';
import { LoginForm } from '@/components/player/auth-forms';
import { Skeleton } from '@/components/ui/misc';

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}
