'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, UpdateProfileSchema, type AuthUserDto, type ChangePasswordInput } from '@spinharbor/contracts';
import { Bell, BellOff, CheckCheck, Dices, KeyRound, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { tierTone } from '@/features/loyalty/use-loyalty';
import { useChangePassword, useMarkNotificationsRead, useNotifications, useUpdateProfile } from '@/features/profile/use-profile';
import { errorMessage } from '@/lib/api';
import { cn, formatDate, relativeTime } from '@/lib/utils';

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  ) : null;
}

export function ProfileCard({ user }: { user: AuthUserDto }) {
  const tone = tierTone[user.loyalty.tier];
  return (
    <section className="card-surface p-6" data-testid="profile-card">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar seed={user.profile.avatarSeed} name={user.profile.displayName} size={88} className="ring-2 ring-border" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">{user.profile.displayName}</h2>
            <Badge variant={statusVariant(user.status)}>{user.status.replace('_', ' ').toLowerCase()}</Badge>
            <Badge className={cn(tone.ring, tone.bg, tone.text)}>{tone.label}</Badge>
            {user.role !== 'PLAYER' && <Badge variant="gold">{user.role.toLowerCase()}</Badge>}
          </div>
          <p className="text-sm text-muted">@{user.username}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Email</dt>
              <dd className="truncate">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Member since</dt>
              <dd>{formatDate(user.createdAt, { dateStyle: 'medium' })}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Country</dt>
              <dd>{user.profile.country || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Points</dt>
              <dd className="tabular">{user.loyalty.points.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const ProfileFormSchema = UpdateProfileSchema.pick({ displayName: true, country: true, avatarSeed: true }).required();
type ProfileFormValues = z.input<typeof ProfileFormSchema>;

export function ProfileForm({ user }: { user: AuthUserDto }) {
  const update = useUpdateProfile();
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(ProfileFormSchema), defaultValues: { displayName: user.profile.displayName, country: user.profile.country, avatarSeed: user.profile.avatarSeed } });
  const seed = useWatch({ control: form.control, name: 'avatarSeed' });
  const displayName = useWatch({ control: form.control, name: 'displayName' });
  const onSubmit = form.handleSubmit((values) =>
    update
      .mutateAsync({ ...values, country: values.country.toUpperCase() })
      .then(() => toast.success('Profile updated'))
      .catch((e) => toast.error('Could not update profile', { description: errorMessage(e) })),
  );
  return (
    <form onSubmit={onSubmit} className="card-surface flex flex-col gap-4 p-5" data-testid="profile-form">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <UserRound className="size-4 text-violet" /> Edit profile
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...form.register('displayName')} data-testid="profile-display-name" />
          <FieldError message={form.formState.errors.displayName?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country (ISO-2)</Label>
          <Input id="country" maxLength={2} placeholder="DE" className="uppercase" {...form.register('country')} data-testid="profile-country" />
          <FieldError message={form.formState.errors.country?.message} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="avatarSeed">Avatar seed</Label>
        <div className="flex items-center gap-3">
          <Avatar seed={seed || 'seed'} name={displayName || user.profile.displayName} size={40} />
          <Input id="avatarSeed" {...form.register('avatarSeed')} data-testid="profile-avatar-seed" />
          <Button type="button" variant="outline" size="icon" aria-label="Random seed" onClick={() => form.setValue('avatarSeed', Math.random().toString(36).slice(2, 10), { shouldDirty: true })}>
            <Dices />
          </Button>
        </div>
        <p className="text-xs text-muted-2">The seed deterministically picks your avatar gradient – no uploads needed.</p>
        <FieldError message={form.formState.errors.avatarSeed?.message} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty} data-testid="profile-save">
          Save changes
        </Button>
      </div>
    </form>
  );
}

const PasswordFormSchema = ChangePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

export function PasswordForm() {
  const change = useChangePassword();
  const form = useForm<PasswordFormValues>({ resolver: zodResolver(PasswordFormSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const onSubmit = form.handleSubmit((values) => {
    const input: ChangePasswordInput = { currentPassword: values.currentPassword, newPassword: values.newPassword };
    return change
      .mutateAsync(input)
      .then(() => {
        toast.success('Password changed');
        form.reset();
      })
      .catch((e) => {
        const msg = errorMessage(e);
        if (e?.code === 'INVALID_CREDENTIALS' || e?.status === 401 || e?.status === 400) form.setError('currentPassword', { message: msg });
        else toast.error('Could not change password', { description: msg });
      });
  });
  return (
    <form onSubmit={onSubmit} className="card-surface flex flex-col gap-4 p-5" data-testid="password-form">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <KeyRound className="size-4 text-violet" /> Change password
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')} data-testid="password-current" />
        <FieldError message={form.formState.errors.currentPassword?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} data-testid="password-new" />
          <FieldError message={form.formState.errors.newPassword?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} data-testid="password-confirm" />
          <FieldError message={form.formState.errors.confirm?.message} />
        </div>
      </div>
      <p className="text-xs text-muted-2">At least 8 characters with a letter and a number. Changing it signs out other devices.</p>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={change.isPending} data-testid="password-save">
          Update password
        </Button>
      </div>
    </form>
  );
}

export function NotificationsList() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = notifications.data?.items ?? [];
  const unread = notifications.data?.unread ?? 0;
  return (
    <section id="notifications" className="card-surface scroll-mt-24 p-5" data-testid="notifications">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Bell className="size-4 text-violet" /> Notifications
          {unread > 0 && <Badge variant="purple">{unread} unread</Badge>}
        </h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" loading={markRead.isPending} onClick={() => markRead.mutateAsync(undefined).catch((e) => toast.error(errorMessage(e)))} data-testid="notifications-mark-all">
            <CheckCheck /> Mark all read
          </Button>
        )}
      </div>
      {notifications.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : notifications.isError ? (
        <EmptyState title="Could not load notifications" description={errorMessage(notifications.error)} className="py-8" />
      ) : items.length === 0 ? (
        <EmptyState icon={<BellOff />} title="You're all caught up" description="Bonus awards, tier changes and account notices will land here." className="py-8" />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className={cn('flex items-start gap-3 py-3', !n.readAt && 'bg-purple/5 -mx-2 rounded-md px-2')} data-testid="notification-item" data-read={!!n.readAt}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-border-strong' : 'bg-violet')} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm', !n.readAt && 'font-semibold')}>{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-2" title={formatDate(n.createdAt)}>
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted">{n.body}</p>
              </div>
              {!n.readAt && (
                <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)} aria-label="Mark as read">
                  Read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
