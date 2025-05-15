import { AppShell } from '@/components/layout/app-shell';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
