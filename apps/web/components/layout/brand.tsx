import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="sh-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b6bff" />
          <stop offset="100%" stopColor="#6d3df5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#sh-brand)" />
      <circle cx="24" cy="13" r="4" stroke="#fff" strokeWidth="3" />
      <path d="M24 17v18" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M15 22h18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M11 29c2 6 8 9 13 9s11-3 13-9" stroke="#d4a84b" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className, href = '/', compact = false }: { className?: string; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5 focus-ring rounded-md', className)} aria-label="SpinHarbor home">
      <BrandMark />
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight">
          Spin<span className="gold-text">Harbor</span>
        </span>
      )}
    </Link>
  );
}
