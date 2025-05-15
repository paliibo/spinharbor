'use client';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/player/auth-forms';
import { Skeleton } from '@/components/ui/misc';

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-xl" />}>
      <RegisterForm />
    </Suspense>
  );
}
