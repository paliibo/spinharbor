'use client';
import { LogOut, Shield, Timer, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RequireAuth } from '@/components/layout/require-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-auth';
import { useUpdateProfile } from '@/features/profile/use-profile';
import { errorMessage } from '@/lib/api';

const REMINDERS = [
  { value: 0, label: 'Off' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
];

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const user = useAuthStore((s) => s.user)!;
  const update = useUpdateProfile();
  const logout = useLogout();
  const router = useRouter();
  const save = (patch: Parameters<typeof update.mutateAsync>[0], label: string) => update.mutateAsync(patch).then(() => toast.success(label)).catch((e) => toast.error('Could not save', { description: errorMessage(e) }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Settings" description="Preferences are stored on your profile and apply on every device." />

      <section className="card-surface divide-y divide-border">
        <Row icon={Volume2} title="Game sounds" text="Spin, roll and cash-out audio inside the game engines.">
          <Switch checked={user.profile.soundEnabled} disabled={update.isPending} onCheckedChange={(v) => save({ soundEnabled: v }, v ? 'Sounds on' : 'Sounds off')} aria-label="Game sounds" data-testid="sound-toggle" />
        </Row>
        <Row icon={Timer} title="Session reminder" text="A gentle in-app reminder of how long you have been playing.">
          <div className="w-48">
            <Label htmlFor="reminder" className="sr-only">
              Reminder interval
            </Label>
            <Select value={String(user.profile.sessionReminderMinutes)} onValueChange={(v) => save({ sessionReminderMinutes: Number(v) }, 'Reminder updated')} disabled={update.isPending}>
              <SelectTrigger id="reminder" data-testid="session-reminder-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDERS.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Row>
        <Row icon={Shield} title="Responsible gaming" text="Wager, loss and session limits, cooling-off and self-exclusion.">
          <Button variant="outline" asChild>
            <Link href="/responsible-gaming">Manage limits</Link>
          </Button>
        </Row>
        <Row icon={LogOut} title="Sign out of this device" text="Revokes the refresh token for this browser only. Other sessions stay signed in.">
          <Button variant="danger" loading={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => router.push('/login') })} data-testid="settings-logout">
            Sign out
          </Button>
        </Row>
      </section>
    </div>
  );
}

function Row({ icon: Icon, title, text, children }: { icon: typeof Volume2; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-violet">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{text}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-6">{children}</div>
    </div>
  );
}
