'use client';
import { RequireAuth } from '@/components/layout/require-auth';
import { NotificationsList, PasswordForm, ProfileCard, ProfileForm } from '@/components/player/profile-cards';
import { PageHeader } from '@/components/ui/misc';
import { useAuthStore } from '@/features/auth/auth-store';

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const user = useAuthStore((s) => s.user)!;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Who you are in the harbor. Demo accounts carry no personal data beyond what you type here." />
      <ProfileCard user={user} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm key={user.profile.avatarSeed + user.profile.displayName + user.profile.country} user={user} />
        <PasswordForm />
      </div>
      <NotificationsList />
    </div>
  );
}
