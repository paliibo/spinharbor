'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminSettingsSchema } from '@spinharbor/contracts';
import { Lock, Save } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { useAdminSettings, useStaffRole, useUpdateSettings, type AdminSettingRow, type SettingKey } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { creditsToMinor, minorToCredits } from '@/lib/format';
import { ErrorCard, Field, Section, TimeCell } from '@/components/admin/shared';

/** Credits-facing form schema derived from the contract (minor-unit fields become credits). */
const SettingsFormSchema = AdminSettingsSchema.omit({ maxBetMinor: true, dailyTopupLimitMinor: true }).extend({
  maintenanceMode: z.boolean(),
  maxBet: z.number({ error: 'Enter a max bet' }).positive('Must be > 0'),
  crashHouseEdgeBp: z.number({ error: 'Enter the house edge' }).int().min(0).max(2000),
  dailyTopupLimit: z.number({ error: 'Enter a limit' }).positive('Must be > 0'),
  sessionReminderDefaultMinutes: z.number({ error: 'Enter minutes' }).int().min(0).max(240),
});
type SettingsForm = z.infer<typeof SettingsFormSchema>;

function toForm(rows: AdminSettingRow[]): SettingsForm {
  const get = (k: SettingKey) => rows.find((r) => r.key === k)?.value;
  return {
    maintenanceMode: Boolean(get('maintenanceMode')),
    maxBet: minorToCredits(Number(get('maxBetMinor') ?? 0)),
    crashHouseEdgeBp: Number(get('crashHouseEdgeBp') ?? 0),
    dailyTopupLimit: minorToCredits(Number(get('dailyTopupLimitMinor') ?? 0)),
    sessionReminderDefaultMinutes: Number(get('sessionReminderDefaultMinutes') ?? 0),
  };
}

const COPY: Record<SettingKey, { label: string; explain: string }> = {
  maintenanceMode: { label: 'Maintenance mode', explain: 'Blocks new game sessions platform-wide. Existing sessions can finish their open round. Use before deploying engine changes.' },
  maxBetMinor: { label: 'Global max bet (credits)', explain: 'Hard ceiling applied on every stake regardless of the game’s own max bet. The API rejects higher stakes with BET_TOO_HIGH.' },
  crashHouseEdgeBp: { label: 'Crash house edge (basis points)', explain: '100 bp = 1%. Applied when the next crash round’s multiplier is derived from the committed seed; it never changes a running round.' },
  dailyTopupLimitMinor: { label: 'Daily top-up limit (credits)', explain: 'Max demo credits a player can receive per UTC day from demo resets and bonus awards combined.' },
  sessionReminderDefaultMinutes: { label: 'Session reminder default (minutes)', explain: 'Reminder interval for players who have not set their own. 0 disables reminders by default.' },
};

export default function AdminSettingsPage() {
  const q = useAdminSettings();
  const update = useUpdateSettings();
  const { isAdmin } = useStaffRole();
  const form = useForm<SettingsForm>({ resolver: zodResolver(SettingsFormSchema) });
  useEffect(() => {
    if (q.data) form.reset(toForm(q.data));
  }, [q.data, form]);
  const err = form.formState.errors;
  const meta = (k: SettingKey) => q.data?.find((r) => r.key === k);
  const Meta = ({ k }: { k: SettingKey }) => {
    const m = meta(k);
    if (!m) return null;
    return (
      <span className="flex items-center gap-2 text-[11px] text-muted-2">
        {m.isDefault ? <Badge variant="outline">default</Badge> : <Badge variant="purple">custom</Badge>}
        {m.updatedAt && (
          <>
            updated <TimeCell iso={m.updatedAt} />
          </>
        )}
      </span>
    );
  };

  if (q.isPending) return <Skeleton className="h-96" aria-busy />;
  if (q.isError) return <ErrorCard error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader eyebrow="Platform" title="Settings" description="Runtime configuration read by the API on every request. Changes are audited." actions={!isAdmin && <Badge variant="warning"><Lock className="size-3" /> read-only · requires ADMIN</Badge>} />
      <form
        onSubmit={form.handleSubmit((v) => {
          const payload = AdminSettingsSchema.parse({ maintenanceMode: v.maintenanceMode, maxBetMinor: creditsToMinor(v.maxBet), crashHouseEdgeBp: v.crashHouseEdgeBp, dailyTopupLimitMinor: creditsToMinor(v.dailyTopupLimit), sessionReminderDefaultMinutes: v.sessionReminderDefaultMinutes });
          return update
            .mutateAsync(payload)
            .then(() => toast.success('Settings saved'))
            .catch((e) => toast.error(errorMessage(e)));
        })}
        className="space-y-4"
        data-testid="admin-settings-form"
      >
        <fieldset disabled={!isAdmin} className="space-y-4">
          <Section title={COPY.maintenanceMode.label} description={COPY.maintenanceMode.explain} actions={<Meta k="maintenanceMode" />}>
            <Controller
              control={form.control}
              name="maintenanceMode"
              render={({ field }) => (
                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={!isAdmin} data-testid="setting-maintenance" />
                  {field.value ? <span className="font-semibold text-warning">Enabled — new sessions are blocked</span> : <span className="text-muted">Disabled — platform open</span>}
                </label>
              )}
            />
          </Section>
          <Section title={COPY.maxBetMinor.label} description={COPY.maxBetMinor.explain} actions={<Meta k="maxBetMinor" />}>
            <Field label="Credits" error={err.maxBet?.message} className="max-w-xs">
              <Input type="number" step="0.01" min="0.01" {...form.register('maxBet', { valueAsNumber: true })} data-testid="setting-max-bet" />
            </Field>
          </Section>
          <Section title={COPY.crashHouseEdgeBp.label} description={COPY.crashHouseEdgeBp.explain} actions={<Meta k="crashHouseEdgeBp" />}>
            <Field label="Basis points" error={err.crashHouseEdgeBp?.message} className="max-w-xs" hint={`= ${((form.watch('crashHouseEdgeBp') || 0) / 100).toFixed(2)}% edge`}>
              <Input type="number" step="1" min="0" max="2000" {...form.register('crashHouseEdgeBp', { valueAsNumber: true })} data-testid="setting-crash-edge" />
            </Field>
          </Section>
          <Section title={COPY.dailyTopupLimitMinor.label} description={COPY.dailyTopupLimitMinor.explain} actions={<Meta k="dailyTopupLimitMinor" />}>
            <Field label="Credits per day" error={err.dailyTopupLimit?.message} className="max-w-xs">
              <Input type="number" step="0.01" min="0.01" {...form.register('dailyTopupLimit', { valueAsNumber: true })} data-testid="setting-topup-limit" />
            </Field>
          </Section>
          <Section title={COPY.sessionReminderDefaultMinutes.label} description={COPY.sessionReminderDefaultMinutes.explain} actions={<Meta k="sessionReminderDefaultMinutes" />}>
            <Field label="Minutes" error={err.sessionReminderDefaultMinutes?.message} className="max-w-xs">
              <Input type="number" step="1" min="0" max="240" {...form.register('sessionReminderDefaultMinutes', { valueAsNumber: true })} data-testid="setting-reminder" />
            </Field>
          </Section>
        </fieldset>
        {isAdmin && (
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => q.data && form.reset(toForm(q.data))} disabled={!form.formState.isDirty}>
              Reset
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty} data-testid="settings-save">
              <Save /> Save settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
