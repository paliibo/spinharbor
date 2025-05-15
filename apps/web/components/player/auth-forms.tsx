'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, RegisterSchema, type LoginInput, type RegisterInput } from '@spinharbor/contracts';
import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useRegister } from '@/features/auth/use-auth';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { FieldError } from './profile-cards';

const DEMO_ACCOUNTS = [
  { label: 'Player', identifier: 'player@spinharbor.demo', password: 'Player123!', hint: 'Full player experience' },
  { label: 'Operator', identifier: 'operator@spinharbor.demo', password: 'Operator123!', hint: 'Player + operator dashboard' },
  { label: 'Admin', identifier: 'admin@spinharbor.demo', password: 'Admin123!', hint: 'Everything, incl. settings' },
];

/** Only allow same-origin relative redirects. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function PasswordInput({ id, testId, autoComplete, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; testId: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} className="pr-10" data-testid={testId} {...rest} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text focus-ring" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert" data-testid="auth-error">
      {message}
    </div>
  ) : null;
}

function describeError(e: unknown, fallback: string): string {
  if (e instanceof ApiRequestError) {
    switch (e.code) {
      case 'INVALID_CREDENTIALS':
        return 'Email/username or password is incorrect.';
      case 'ACCOUNT_SUSPENDED':
      case 'ACCOUNT_CLOSED':
        return e.message || 'This account cannot sign in.';
      case 'EMAIL_TAKEN':
        return 'That email is already registered.';
      case 'USERNAME_TAKEN':
        return 'That username is taken.';
      case 'RATE_LIMITED':
        return 'Too many attempts – please wait a moment.';
    }
    if (e.status === 429) return 'Too many attempts – please wait a moment.';
    if (e.status === 409) return e.message || 'Already registered.';
  }
  return errorMessage(e) || fallback;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const login = useLogin();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginSchema), defaultValues: { identifier: '', password: '' } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    return login
      .mutateAsync(values)
      .then((r) => {
        toast.success(`Welcome back, ${r.user.profile.displayName}`);
        router.push(next);
      })
      .catch((e) => setError(describeError(e, 'Sign-in failed')));
  });

  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Pick up where you left off. Demo credits are waiting.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate data-testid="login-form">
        <AuthError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Email or username</Label>
          <Input id="identifier" autoComplete="username" autoFocus placeholder="player@spinharbor.demo" {...form.register('identifier')} data-testid="login-identifier" />
          <FieldError message={form.formState.errors.identifier?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" testId="login-password" autoComplete="current-password" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <Button type="submit" className="w-full" size="lg" loading={login.isPending} data-testid="login-submit">
          Sign in <ArrowRight />
        </Button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-border p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Sparkles className="size-3.5 text-gold" /> Demo accounts
        </p>
        <ul className="mt-2 space-y-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.identifier} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-text">
                  {a.identifier} <span className="text-muted-2">/</span> <span className="font-mono">{a.password}</span>
                </p>
                <p className="text-muted-2">{a.hint}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  form.setValue('identifier', a.identifier, { shouldValidate: true });
                  form.setValue('password', a.password, { shouldValidate: true });
                  setError(null);
                }}
                data-testid={`fill-${a.label.toLowerCase()}`}
              >
                Fill {a.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link href={next !== '/' ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-violet hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}

/** Same rules as RegisterSchema, but the checkbox is a boolean until submit. */
const RegisterFormSchema = RegisterSchema.omit({ acceptTerms: true }).extend({ acceptTerms: z.boolean().refine((v) => v, { message: 'You must accept the demo terms' }) });
type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const register = useRegister();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({ resolver: zodResolver(RegisterFormSchema), defaultValues: { email: '', username: '', password: '', displayName: undefined, acceptTerms: false } });
  const acceptTerms = useWatch({ control: form.control, name: 'acceptTerms' });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    const input: RegisterInput = { email: values.email, username: values.username, password: values.password, displayName: values.displayName?.trim() || undefined, acceptTerms: true };
    return register
      .mutateAsync(input)
      .then((r) => {
        toast.success(`Welcome aboard, ${r.user.profile.displayName}`, { description: '10,000 demo credits have been added to your wallet.' });
        router.push(next);
      })
      .catch((e) => {
        const msg = describeError(e, 'Registration failed');
        if (e instanceof ApiRequestError && e.code === 'EMAIL_TAKEN') form.setError('email', { message: msg });
        else if (e instanceof ApiRequestError && e.code === 'USERNAME_TAKEN') form.setError('username', { message: msg });
        else setError(msg);
      });
  });

  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Join free</h1>
      <p className="mt-1 text-sm text-muted">
        Start with <span className="font-semibold gold-text">10,000 demo credits</span>. No email verification, no payment – it is a portfolio demo.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate data-testid="register-form">
        <AuthError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" {...form.register('email')} data-testid="register-email" />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" placeholder="harbor_hero" {...form.register('username')} data-testid="register-username" />
            <FieldError message={form.formState.errors.username?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input id="displayName" autoComplete="nickname" placeholder="Harbor Hero" {...form.register('displayName', { setValueAs: (v: string) => (v?.trim() ? v : undefined) })} data-testid="register-display-name" />
            <FieldError message={form.formState.errors.displayName?.message} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" testId="register-password" autoComplete="new-password" {...form.register('password')} />
          <p className="text-xs text-muted-2">8+ characters with at least one letter and one number.</p>
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="acceptTerms" className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox id="acceptTerms" checked={acceptTerms} onCheckedChange={(v) => form.setValue('acceptTerms', v === true, { shouldValidate: form.formState.isSubmitted })} className="mt-0.5" data-testid="register-terms" />
            <span className="text-muted">
              I understand SpinHarbor is a <span className="text-text">demo platform</span>: credits are virtual, have no value and cannot be deposited or withdrawn. I am 18 or older.
            </span>
          </label>
          <FieldError message={form.formState.errors.acceptTerms?.message} />
        </div>
        <Button type="submit" variant="gold" className="w-full" size="lg" loading={register.isPending} data-testid="register-submit">
          Create account <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-violet hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
