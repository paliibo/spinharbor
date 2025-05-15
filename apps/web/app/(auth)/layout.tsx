import { Brand } from '@/components/layout/brand';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(109,61,245,0.25),transparent_60%),radial-gradient(50%_40%_at_90%_90%,rgba(212,168,75,0.12),transparent_60%)]" />
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Brand />
          <Link href="/" className="text-sm text-muted hover:text-text">
            ← Back to casino
          </Link>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted-2">Demo platform · virtual credits only · no real money</p>
      </div>
    </div>
  );
}
