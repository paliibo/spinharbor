import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { RequireAuth } from '@/components/layout/require-auth';

export const metadata: Metadata = { title: 'Operator console' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth staff>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
