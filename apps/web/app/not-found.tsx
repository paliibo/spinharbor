import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black gold-text">404</p>
      <p className="text-muted">That page drifted out of the harbor.</p>
      <Button asChild>
        <Link href="/">Back to the lobby</Link>
      </Button>
    </div>
  );
}
