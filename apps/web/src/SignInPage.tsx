import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Box,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Lightbulb,
  LockKeyhole,
  PackageCheck,
  Route,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import { Button } from '@masaar/ui';
import { registerBusiness, signIn, type AuthSession } from './api';

const DEMOS = [
  {
    role: 'Owner',
    email: 'joe@masaar.demo',
    name: 'Joe',
    detail: 'Full control',
    icon: ShieldCheck,
  },
  {
    role: 'Manager',
    email: 'manager@masaar.demo',
    name: 'Nadim',
    detail: 'Team operations',
    icon: BarChart3,
  },
  {
    role: 'Employee',
    email: 'employee@masaar.demo',
    name: 'Rami',
    detail: 'Orders & customers',
    icon: PackageCheck,
  },
  {
    role: 'Driver',
    email: 'driver@masaar.demo',
    name: 'Karim',
    detail: 'Assigned deliveries',
    icon: Route,
  },
] as const;

const DEV_AUTH_ENABLED =
  import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';
const JUDGE_DEMOS_VISIBLE =
  DEV_AUTH_ENABLED || import.meta.env.VITE_JUDGE_DEMOS === 'true';

const TOOL_TILES = [
  { label: 'Orders', icon: ShoppingCart, color: 'text-brand-gold' },
  { label: 'Payments', icon: CreditCard, color: 'text-brand-teal' },
  { label: 'Deliveries', icon: Truck, color: 'text-[#84cbff]' },
  { label: 'Stock', icon: Box, color: 'text-[#8ce2af]' },
  { label: 'Insights', icon: BarChart3, color: 'text-brand-gold' },
] as const;

export function SignInPage({ onSignedIn }: { onSignedIn: (auth: AuthSession) => void }) {
  const [mode, setMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');
  const [email, setEmail] = useState(JUDGE_DEMOS_VISIBLE ? 'joe@masaar.demo' : '');
  const [password, setPassword] = useState(JUDGE_DEMOS_VISIBLE ? 'Masaar-Demo1!' : '');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(
        mode === 'SIGN_IN'
          ? await signIn(email, password)
          : await registerBusiness({ businessName, ownerName, email, password }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen tech-grid relative h-[100dvh] overflow-hidden bg-brand-navy p-3 sm:p-5">
      <div
        aria-hidden="true"
        className="signal-orb absolute -left-20 top-16 size-72 rounded-full bg-brand-teal/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="signal-orb absolute -right-16 bottom-8 size-80 rounded-full bg-brand-gold/12 blur-3xl"
      />

      <div className="relative mx-auto grid h-full max-w-[1480px] overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl lg:grid-cols-[0.86fr_1.14fr]">
        <section className="auth-form-panel flex min-h-0 items-center overflow-hidden px-6 py-5 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[570px]">
            <div className="flex items-center gap-3">
              <img
                src="/brand/masaar-logo-dark.png"
                alt="Masaar"
                className="size-12 rounded-2xl object-cover shadow-lg"
              />
              <div>
                <p className="font-display text-[22px] font-bold tracking-tight text-brand-navy">
                  Masaar
                </p>
                <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-brand-teal-deep">
                  Business command center
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-surface-muted p-1">
              <button
                type="button"
                onClick={() => setMode('SIGN_IN')}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-white/70 ${mode === 'SIGN_IN' ? 'bg-white text-brand-navy shadow-sm' : 'text-ink-muted'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setEmail('');
                  setPassword('');
                }}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-white/70 ${mode === 'REGISTER' ? 'bg-white text-brand-navy shadow-sm' : 'text-ink-muted'}`}
              >
                Create a business
              </button>
            </div>

            <div className="auth-intro mt-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-3 py-1.5 text-[11px] font-bold text-brand-teal-deep">
                <Sparkles className="size-3.5" />{' '}
                {mode === 'SIGN_IN'
                  ? 'Your role shapes your workspace'
                  : 'Start clean—no demo data'}
              </span>
              <h1 className="mt-3 font-display text-[42px] font-bold leading-[1.02] tracking-[-.045em] text-brand-navy sm:text-[46px]">
                {mode === 'SIGN_IN' ? 'Run the business.' : 'Build your workspace.'}
                <br />
                <span className="text-brand-teal-deep">
                  {mode === 'SIGN_IN' ? 'See the truth.' : 'Invite the right people.'}
                </span>
              </h1>
              <p className="mt-3 max-w-lg text-[13px] leading-5 text-ink-muted">
                {mode === 'SIGN_IN'
                  ? 'One secure workspace for the people handling your orders, customers, prices and deliveries.'
                  : 'Create the company first, then Masaar guides you through products, team access and delivery setup.'}
              </p>
            </div>

            <form className="auth-form mt-5 space-y-3" onSubmit={submit}>
              {mode === 'REGISTER' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-brand-navy">
                      Business name
                    </span>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-brand-teal-deep" />
                      <input
                        required
                        aria-label="Business name"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        className="min-h-12 w-full rounded-xl border border-border bg-surface-muted pl-11 pr-3 text-sm outline-none focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal-soft"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-brand-navy">
                      Your name
                    </span>
                    <div className="relative">
                      <UserRound className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-brand-teal-deep" />
                      <input
                        required
                        aria-label="Owner name"
                        value={ownerName}
                        onChange={(event) => setOwnerName(event.target.value)}
                        className="min-h-12 w-full rounded-xl border border-border bg-surface-muted pl-11 pr-3 text-sm outline-none focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal-soft"
                      />
                    </div>
                  </label>
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-brand-navy">
                  {mode === 'REGISTER' ? 'Owner email' : 'Work email'}
                </span>
                <div className="relative">
                  <UserRoundCheck className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-brand-teal-deep" />
                  <input
                    aria-label={mode === 'REGISTER' ? 'Owner email' : 'Work email'}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-border bg-surface-muted pl-11 pr-4 text-sm outline-none transition focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal-soft"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-brand-navy">Password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-brand-teal-deep" />
                  <input
                    aria-label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-border bg-surface-muted pl-11 pr-11 text-sm outline-none transition focus:border-brand-teal focus:bg-white focus:ring-4 focus:ring-brand-teal-soft"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted"
                  >
                    {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
              </label>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-danger-soft px-4 py-2.5 text-xs font-semibold text-danger-strong"
                >
                  {error}
                </p>
              )}
              <Button
                className="min-h-12 w-full rounded-xl text-sm shadow-[0_12px_26px_rgba(0,168,156,.22)]"
                disabled={busy}
              >
                {busy
                  ? mode === 'REGISTER'
                    ? 'Creating your business…'
                    : 'Opening your workspace…'
                  : mode === 'REGISTER'
                    ? 'Create business workspace'
                    : 'Enter Masaar'}
                <ArrowRight className="size-4.5" />
              </Button>
            </form>

            {mode === 'SIGN_IN' && JUDGE_DEMOS_VISIBLE && (
              <div className="auth-role-picker mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-ink-muted">
                    Demo by role
                  </p>
                  <p className="text-[10px] text-ink-muted">
                    Password: <strong>Masaar-Demo1!</strong>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMOS.map(({ role, email: demoEmail, name, detail, icon: Icon }) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() => {
                        setEmail(demoEmail);
                        setPassword('Masaar-Demo1!');
                      }}
                      className={`clickable-surface rounded-xl border px-2.5 py-2 text-left ${email === demoEmail ? 'border-brand-teal bg-brand-teal-soft' : 'border-border bg-white'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-navy text-brand-teal">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-[11px] text-brand-navy">
                            {name} · {role}
                          </strong>
                          <span className="block truncate text-[9px] text-ink-muted">{detail}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <AuthVisual />
      </div>
    </main>
  );
}

function AuthVisual() {
  return (
    <section className="auth-visual relative hidden min-h-0 overflow-hidden bg-brand-navy text-white lg:flex lg:flex-col">
      <div className="absolute inset-0 tech-grid opacity-80" />
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 size-64 rounded-full bg-brand-teal/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 left-1/4 size-80 rounded-full bg-brand-gold/10 blur-3xl"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 900 760"
        className="absolute inset-0 h-full w-full opacity-65"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="signal" x1="0" x2="1">
            <stop stopColor="#00a89c" stopOpacity="0" />
            <stop offset=".45" stopColor="#00d1c1" />
            <stop offset="1" stopColor="#d9ad58" stopOpacity=".15" />
          </linearGradient>
        </defs>
        <path
          d="M-40 535 C170 445 255 610 455 478 S730 320 950 385"
          fill="none"
          stroke="url(#signal)"
          strokeWidth="1.2"
        />
        <path
          d="M-20 590 C180 500 302 665 535 520 S760 445 950 475"
          fill="none"
          stroke="url(#signal)"
          strokeWidth=".7"
          strokeDasharray="4 9"
        />
        <path d="M90 140 H320 L385 205 H760" fill="none" stroke="#00a89c" strokeOpacity=".22" />
        {[
          ['180', '495', '#00d1c1'],
          ['440', '487', '#d9ad58'],
          ['690', '404', '#00d1c1'],
          ['780', '470', '#d9ad58'],
        ].map(([cx, cy, fill]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill={fill} />
        ))}
      </svg>

      <div className="relative z-10 flex h-full flex-col p-7 xl:p-9">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src="/brand/masaar-logo-dark.png"
              alt="Masaar logo"
              className="size-[92px] rounded-[24px] object-cover shadow-[0_16px_40px_rgba(0,0,0,.35)] ring-1 ring-white/10 xl:size-[108px]"
            />
            <div>
              <p className="font-display text-4xl font-bold tracking-[-.04em] xl:text-5xl">
                Masaar
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.24em] text-brand-teal">
                Smart tools for Lebanese businesses
              </p>
            </div>
          </div>
          <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-brand-gold">
            Lebanon-first
          </span>
        </div>

        <div className="mt-6 max-w-2xl xl:mt-8">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-brand-gold">
            <Sparkles className="size-3.5" /> Built around Lebanese reality
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-.035em] xl:text-[38px]">
            From social-media orders
            <br />
            to decisions you can act on.
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-white/55">
            Clear operations first. Business intelligence built from real activity—not another
            disconnected dashboard.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2 xl:mt-6 xl:gap-3">
          {TOOL_TILES.map(({ label, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[.055] px-2 py-3 text-center backdrop-blur-sm transition hover:-translate-y-1 hover:bg-white/10"
            >
              <Icon className={`mx-auto size-5 ${color}`} />
              <p className="mt-2 text-[10px] font-bold text-white/75">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto grid min-h-0 grid-cols-[.82fr_1.18fr] items-end gap-4 pt-5">
          <div className="pb-3">
            <div className="relative mx-auto h-[172px] w-[150px]">
              <div className="absolute left-3 top-0 h-32 w-20 rotate-[-7deg] rounded-[48%_52%_58%_42%/35%_45%_55%_65%] border border-brand-teal/35 bg-brand-teal/5 shadow-[0_0_40px_rgba(0,168,156,.12)]" />
              <div className="absolute left-0 top-16 h-px w-full rotate-[-18deg] bg-gradient-to-r from-transparent via-brand-teal to-transparent" />
              <span className="signal-orb absolute left-4 top-[92px] size-2.5 rounded-full bg-brand-teal shadow-[0_0_18px_#00d1c1]" />
              <span className="signal-orb absolute right-6 top-[50px] size-2.5 rounded-full bg-brand-gold shadow-[0_0_18px_#d9ad58]" />
              <p className="absolute bottom-0 left-0 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">
                Beirut → every order
              </p>
            </div>
          </div>

          <div className="brand-glow rounded-[22px] border border-white/10 bg-[#061d2d]/95 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/35">
                  Today’s pulse
                </p>
                <p className="mt-1 font-display text-2xl font-bold">$12,840</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/12 px-2 py-1 text-[9px] font-bold text-brand-teal">
                <TrendingUp className="size-3" /> 12.5%
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[1.25fr_.75fr] gap-3">
              <div className="rounded-xl bg-white/[.04] p-3">
                <div className="flex h-20 items-end gap-2">
                  {[34, 52, 44, 68, 61, 86, 76].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-gradient-to-t from-brand-teal-deep to-brand-teal"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[9px] font-semibold text-white/40">Revenue trend</p>
              </div>
              <div className="rounded-xl bg-white/[.04] p-3">
                <Lightbulb className="size-4 text-brand-gold" />
                <p className="mt-2 text-[10px] font-bold">2 actions</p>
                <p className="mt-1 text-[9px] leading-4 text-white/40">
                  Low stock
                  <br />
                  Cash to collect
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
