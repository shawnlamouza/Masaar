import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AdminTaskCategory,
  CustomerSegment,
  ExpansionSnapshot,
  IntegrationProvider,
  Role,
} from '@masaar/contracts';
import { Button, Card, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileCheck2,
  Globe2,
  Landmark,
  Mail,
  MessageCircle,
  Plus,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { createAdminTask, getExpansionSnapshot, updateAdminTask } from './api';

type Tab = 'Launch control' | 'Lebanon desk' | 'Integrations' | 'Customer growth';
type Target =
  | 'Catalog'
  | 'Customers'
  | 'Orders'
  | 'Delivery'
  | 'Payments'
  | 'Business setup'
  | 'Launch Center';

const TABS: Array<{ label: Tab; icon: typeof Rocket }> = [
  { label: 'Launch control', icon: Rocket },
  { label: 'Lebanon desk', icon: Landmark },
  { label: 'Integrations', icon: Globe2 },
  { label: 'Customer growth', icon: UsersRound },
];

const CATEGORIES = [
  'REGISTRATION',
  'TAX',
  'NSSF',
  'LICENSE',
  'DOCUMENT',
  'CONTINUITY',
  'OTHER',
] as const;

const categoryLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

const money = (minor: number) => `$${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function LaunchCenterWorkspace({
  role,
  onOpenView,
}: {
  role: Role;
  onOpenView: (view: Target) => void;
}) {
  const [snapshot, setSnapshot] = useState<ExpansionSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('Launch control');
  const [error, setError] = useState('');

  async function reload() {
    try {
      setSnapshot(await getExpansionSnapshot(role));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open the launch center.');
    }
  }

  useEffect(() => {
    void reload();
  }, [role]);

  if (!snapshot && !error)
    return (
      <div className="mx-auto max-w-[1500px] space-y-5">
        <Skeleton className="h-[360px] rounded-[30px]" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </div>
    );

  if (!snapshot)
    return (
      <Card className="mx-auto max-w-3xl border-danger-strong/20 bg-danger-soft">
        <p className="font-display text-xl font-bold text-danger-strong">Launch Center unavailable</p>
        <p className="mt-2 text-sm text-danger-strong">{error}</p>
        <Button className="mt-4" onClick={() => void reload()}>
          Try again
        </Button>
      </Card>
    );

  const completed = snapshot.checks.filter((check) => check.complete).length;
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="launch-stage depth-stage relative overflow-hidden rounded-[30px] text-white">
        <div className="launch-orbit launch-orbit-one" />
        <div className="launch-orbit launch-orbit-two" />
        <div className="relative grid min-h-[350px] items-center gap-8 p-7 md:p-10 xl:grid-cols-[1.2fr_.8fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-teal/30 bg-brand-teal/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-brand-teal">
                Operational readiness
              </span>
              <span className="rounded-full border border-white/10 bg-white/7 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/60">
                Governed expansion
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-[-.045em] md:text-5xl">
              Launch with proof.
              <br />
              <span className="text-brand-teal">Grow without losing control.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
              Masaar shows what is ready, what still needs setup, who owns local administrative
              follow-up, and which customer groups deserve a thoughtful next move.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              {[
                { label: 'Official APIs only', icon: ShieldCheck },
                { label: 'Human approval', icon: BadgeCheck },
                { label: 'Manual fallback visible', icon: FileCheck2 },
              ].map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/7 px-3 py-2 text-white/75"
                >
                  <Icon className="size-4 text-brand-gold" /> {label}
                </span>
              ))}
            </div>
          </div>
          <div className="launch-prism mx-auto w-full max-w-md rounded-[28px] border border-white/12 bg-white/7 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-5">
              <div
                className="relative grid size-36 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#00b8aa ${snapshot.readinessPercent * 3.6}deg, rgba(255,255,255,.09) 0deg)`,
                }}
              >
                <div className="grid size-[112px] place-items-center rounded-full border border-white/10 bg-brand-navy shadow-inner">
                  <div className="text-center">
                    <strong className="font-display text-3xl">{snapshot.readinessPercent}%</strong>
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-white/45">
                      ready
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                  Pilot gate
                </p>
                <p className="mt-2 font-display text-2xl font-bold">
                  {completed} of {snapshot.checks.length}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  checks use real tenant data and environment configuration.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniSignal label="Operations" active />
              <MiniSignal label="Lebanon" active />
              <MiniSignal label="Production" active={snapshot.readinessPercent === 100} />
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="Launch Center sections"
        className="hide-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm"
      >
        {TABS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setTab(label)}
            className={`clickable-surface flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${tab === label ? 'bg-brand-navy text-white shadow-lg' : 'text-ink-muted hover:bg-surface-muted hover:text-brand-navy'}`}
          >
            <Icon className={`size-4 ${tab === label ? 'text-brand-teal' : ''}`} /> {label}
          </button>
        ))}
      </nav>

      {tab === 'Launch control' && (
        <LaunchControl snapshot={snapshot} onOpenView={onOpenView} />
      )}
      {tab === 'Lebanon desk' && (
        <LebanonDesk role={role} snapshot={snapshot} onChanged={reload} />
      )}
      {tab === 'Integrations' && (
        <Integrations providers={snapshot.integrations} onOpenView={onOpenView} />
      )}
      {tab === 'Customer growth' && <CustomerGrowth segments={snapshot.segments} />}
    </div>
  );
}

function LaunchControl({
  snapshot,
  onOpenView,
}: {
  snapshot: ExpansionSnapshot;
  onOpenView: (view: Target) => void;
}) {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(
    window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  );
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await (installPrompt as Event & { prompt: () => Promise<void> }).prompt();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <section>
        <SectionHeading
          eyebrow="Evidence-based readiness"
          title="Nothing is marked ready because it looks finished."
          detail="Each check reads Masaar records or the active environment, then opens the exact tool needed to close the gap."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.checks.map((check, index) => (
            <button
              key={check.id}
              onClick={() => onOpenView(check.target)}
              className="clickable-surface group rounded-2xl border border-border bg-white p-5 text-left shadow-sm hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid size-10 place-items-center rounded-xl ${check.complete ? 'bg-success-soft text-success-strong' : 'bg-warning-soft text-warning-strong'}`}
                >
                  {check.complete ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
                </span>
                <span className="font-display text-sm font-bold text-ink-muted/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="mt-4 font-display text-lg font-bold text-brand-navy">{check.label}</p>
              <p className="mt-2 text-xs leading-5 text-ink-muted">{check.detail}</p>
              <span className="mt-4 flex items-center gap-1 text-xs font-bold text-brand-teal-deep">
                Open {check.target}{' '}
                <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-gold">
            System health
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Technical infrastructure is shown here, separate from the business tools an owner can use.
          </p>
          <div className="mt-4 space-y-3">
            {snapshot.integrations
              .filter((provider) => ['IDENTITY', 'DATABASE'].includes(provider.category))
              .map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-xs text-brand-navy">{provider.name}</strong>
                    <ProviderBadge status={provider.status} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{provider.summary}</p>
                </div>
              ))}
          </div>
        </Card>
        <Card className="overflow-hidden border-0 bg-brand-navy text-white">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-teal/15 text-brand-teal">
              <Smartphone className="size-6" />
            </span>
            <StatusBadge tone={installed ? 'success' : 'info'}>
              {installed ? 'Installed' : 'Mobile ready'}
            </StatusBadge>
          </div>
          <h3 className="mt-5 font-display text-2xl font-bold">Masaar in a driver’s pocket</h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            The web app is installable, touch-friendly and keeps the driver’s outbox and last route
            snapshot available when connectivity disappears.
          </p>
          {installPrompt ? (
            <Button className="mt-5 w-full" onClick={() => void install()}>
              <Download className="size-4" /> Install Masaar
            </Button>
          ) : (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-white/55">
              {installed
                ? 'Running as an installed web app.'
                : 'Use your browser’s “Install app” or “Add to Home screen” option after deployment.'}
            </div>
          )}
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-gold">
            Release guardrails
          </p>
          <div className="mt-4 space-y-3">
            {[
              ['Administration', 'Reminders, not legal advice'],
              ['Providers', 'Official APIs only'],
              ['Customers', 'Segments, never blacklists'],
              ['Automation', 'Human approval required'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-surface-muted p-3">
                <span className="text-xs font-semibold text-ink-muted">{label}</span>
                <strong className="text-right text-xs text-brand-navy">{value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function LebanonDesk({
  role,
  snapshot,
  onChanged,
}: {
  role: Role;
  snapshot: ExpansionSnapshot;
  onChanged: () => Promise<void>;
}) {
  const canEdit = role === 'OWNER';
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    category: 'DOCUMENT' as AdminTaskCategory,
    dueDate: '',
    responsibleName: '',
    notes: '',
    reminderDays: 7,
  });
  const sorted = useMemo(
    () =>
      [...snapshot.adminTasks].sort((left, right) => {
        const weight = { OVERDUE: 0, DUE_SOON: 1, OPEN: 2, DONE: 3 };
        return weight[left.status] - weight[right.status];
      }),
    [snapshot.adminTasks],
  );

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy('create');
    setMessage('');
    try {
      const { dueDate, ...rest } = form;
      await createAdminTask(role, {
        ...rest,
        ...(dueDate ? { dueDate } : {}),
      });
      setFormOpen(false);
      setForm({
        title: '',
        category: 'DOCUMENT',
        dueDate: '',
        responsibleName: '',
        notes: '',
        reminderDays: 7,
      });
      await onChanged();
      setMessage('Reminder added with owner responsibility and audit history.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not add the reminder.');
    } finally {
      setBusy('');
    }
  }

  async function toggle(id: string, status: 'OPEN' | 'DONE') {
    setBusy(id);
    try {
      await updateAdminTask(role, id, { status });
      await onChanged();
      setMessage(status === 'DONE' ? 'Reminder completed.' : 'Reminder reopened.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not update the reminder.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeading
          eyebrow="Lebanon Admin Organizer"
          title="Keep fragmented obligations from living in memory."
          detail="Track the deadline, responsible person and supporting note. Masaar does not interpret law, file forms or replace an accountant."
        />
        {canEdit && (
          <Button className="shrink-0 whitespace-nowrap" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Add reminder
          </Button>
        )}
      </div>
      {message && (
        <div role="status" className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal-soft p-3 text-sm font-semibold text-brand-teal-deep">
          {message}
        </div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {sorted.map((task) => (
          <Card key={task.id} className={task.status === 'DONE' ? 'opacity-65' : ''}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-gold-soft text-warning-strong">
                <CalendarClock className="size-5" />
              </span>
              <StatusBadge
                tone={
                  task.status === 'DONE'
                    ? 'success'
                    : task.status === 'OVERDUE'
                      ? 'danger'
                      : task.status === 'DUE_SOON'
                        ? 'warning'
                        : 'info'
                }
              >
                {categoryLabel(task.status)}
              </StatusBadge>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-brand-teal-deep">
              {categoryLabel(task.category)}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-brand-navy">{task.title}</h3>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-muted">{task.notes}</p>
            <div className="mt-4 rounded-xl bg-surface-muted p-3 text-xs">
              <p><strong className="text-brand-navy">Due:</strong> {task.dueDate ? new Date(`${task.dueDate}T12:00:00`).toLocaleDateString() : 'No date'}</p>
              <p className="mt-1"><strong className="text-brand-navy">Owner:</strong> {task.responsibleName || 'Unassigned'}</p>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                disabled={busy === task.id}
                onClick={() => void toggle(task.id, task.status === 'DONE' ? 'OPEN' : 'DONE')}
              >
                {task.status === 'DONE' ? <CalendarClock className="size-4" /> : <Check className="size-4" />}
                {task.status === 'DONE' ? 'Reopen reminder' : 'Mark complete'}
              </Button>
            )}
          </Card>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-brand-navy/70 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto rounded-[28px] bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">New organizer reminder</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">Assign the obligation, not the advice.</h2>
              </div>
              <button type="button" aria-label="Close" className="rounded-xl p-2 hover:bg-surface-muted" onClick={() => setFormOpen(false)}><X /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Task title" wide><input required className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <Field label="Category"><select className="field" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as AdminTaskCategory })}>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></Field>
              <Field label="Due date"><input type="date" className="field" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
              <Field label="Responsible person"><input className="field" value={form.responsibleName} onChange={(event) => setForm({ ...form, responsibleName: event.target.value })} /></Field>
              <Field label="Remind before (days)"><input type="number" min="0" max="90" className="field" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: Number(event.target.value) })} /></Field>
              <Field label="What must be checked" wide><textarea required rows={4} className="field" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button disabled={busy === 'create'}>{busy === 'create' ? 'Saving…' : 'Save reminder'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Integrations({
  providers,
  onOpenView,
}: {
  providers: IntegrationProvider[];
  onOpenView: (view: Target) => void;
}) {
  const businessProviders = providers.filter(
    (provider) => !['IDENTITY', 'DATABASE'].includes(provider.category),
  );
  const [selected, setSelected] = useState(businessProviders[0]?.id ?? '');
  const icons: Record<IntegrationProvider['category'], typeof Cloud> = {
    IDENTITY: ShieldCheck,
    DATABASE: Database,
    EMAIL: Mail,
    MESSAGING: MessageCircle,
    DELIVERY: Truck,
    PAYMENTS: WalletCards,
  };
  const selectedProvider =
    businessProviders.find((provider) => provider.id === selected) ?? businessProviders[0];
  const targets: Record<string, Target> = {
    'masaar-in-app': 'Orders',
    'amazon-ses': 'Business setup',
    'whatsapp-business': 'Orders',
    'delivery-providers': 'Business setup',
    'payment-providers': 'Payments',
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <section>
        <SectionHeading
          eyebrow="Provider truth"
          title="Every connection leads to a usable business action."
          detail="Messaging, delivery and payment providers use official APIs when configured, while Masaar keeps an explicit manual workflow when connectivity or provider access is unavailable."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {businessProviders.map((provider) => {
            const Icon = icons[provider.category];
            return (
              <button
                key={provider.id}
                onClick={() => setSelected(provider.id)}
                className={`clickable-surface rounded-2xl border p-4 text-left ${selected === provider.id ? 'border-brand-teal bg-brand-teal-soft/50 shadow-lg' : 'border-border bg-white hover:border-brand-teal/35'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-navy text-brand-teal"><Icon className="size-5" /></span>
                  <ProviderBadge status={provider.status} />
                </div>
                <p className="mt-3 font-display font-bold text-brand-navy">{provider.name}</p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">{provider.summary}</p>
              </button>
            );
          })}
        </div>
      </section>
      {selectedProvider && (
        <Card className="launch-provider-panel h-fit overflow-hidden border-0 bg-brand-navy text-white xl:sticky xl:top-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">Integration contract</p>
          <h2 className="mt-2 font-display text-3xl font-bold">{selectedProvider.name}</h2>
          <div className="mt-5"><ProviderBadge status={selectedProvider.status} /></div>
          <DetailBlock label="What is true now" text={selectedProvider.summary} />
          <DetailBlock label="Fallback that remains usable" text={selectedProvider.fallback} />
          <DetailBlock label="Controlled next step" text={selectedProvider.nextStep} />
          <Button
            className="mt-6 w-full"
            onClick={() => onOpenView(targets[selectedProvider.id] ?? 'Business setup')}
          >
            Open the working tool <ArrowUpRight className="size-4" />
          </Button>
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-brand-teal/10 p-3 text-xs font-semibold text-brand-teal">
            <ShieldCheck className="size-4" /> Official provider connections only
          </div>
        </Card>
      )}
    </div>
  );
}

function CustomerGrowth({ segments }: { segments: CustomerSegment[] }) {
  const [selected, setSelected] = useState(segments[0]?.id ?? 'CHAMPIONS');
  const segment = segments.find((candidate) => candidate.id === selected) ?? segments[0];
  function exportSegments() {
    const rows = [
      ['Segment', 'Customers', 'Recorded USD spend', 'Recommended action'],
      ...segments.map((item) => [item.label, String(item.count), (item.revenueUsdMinor / 100).toFixed(2), item.recommendedAction]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `masaar-customer-segments-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeading
          eyebrow="Customer Growth Map"
          title="Useful groups, with a reason and a human next action."
          detail="The same customer can appear in more than one operational group. This is transparent segmentation—not a hidden score and never a blacklist."
        />
        <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={exportSegments}><Download className="size-4" /> Export governed CSV</Button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {segments.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item.id)}
            className={`clickable-surface rounded-2xl border p-5 text-left ${selected === item.id ? 'border-brand-teal bg-brand-navy text-white shadow-xl' : 'border-border bg-white hover:-translate-y-0.5 hover:border-brand-teal/35 hover:shadow-lg'}`}
          >
            <span className={`grid size-10 place-items-center rounded-xl ${selected === item.id ? 'bg-brand-teal/15 text-brand-teal' : 'bg-brand-teal-soft text-brand-teal-deep'}`}><UsersRound className="size-5" /></span>
            <p className={`mt-4 text-[10px] font-bold uppercase tracking-[.16em] ${selected === item.id ? 'text-brand-gold' : 'text-brand-teal-deep'}`}>{item.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{item.count}</p>
            <p className={`mt-1 text-xs ${selected === item.id ? 'text-white/50' : 'text-ink-muted'}`}>{money(item.revenueUsdMinor)} recorded spend</p>
          </button>
        ))}
      </div>
      {segment && (
        <Card className="mt-5 overflow-hidden border-0 bg-gradient-to-br from-white to-brand-teal-soft/45 p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-gold">Why this group exists</p>
              <h3 className="mt-2 font-display text-3xl font-bold text-brand-navy">{segment.label}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{segment.description}</p>
              <div className="mt-5 rounded-2xl bg-brand-navy p-4 text-white">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-brand-teal"><Sparkles className="size-4" /> Recommended next action</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{segment.recommendedAction}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-teal-deep">Included customers</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {segment.customerNames.length ? segment.customerNames.map((name) => (
                  <div key={name} className="flex items-center gap-3 rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-teal-soft text-xs font-bold text-brand-teal-deep">{name.charAt(0)}</span>
                    <span className="text-sm font-bold text-brand-navy">{name}</span>
                  </div>
                )) : <div className="rounded-xl border border-dashed border-border bg-white/60 p-5 text-sm text-ink-muted sm:col-span-2">No customers match this transparent rule yet.</div>}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniSignal({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/6 p-3 text-center">
      <span className={`mx-auto block size-2 rounded-full ${active ? 'bg-brand-teal shadow-[0_0_14px_rgba(0,200,184,.8)]' : 'bg-brand-gold'}`} />
      <span className="mt-2 block text-[9px] font-bold uppercase tracking-wider text-white/45">{label}</span>
    </div>
  );
}

function ProviderBadge({ status }: { status: IntegrationProvider['status'] }) {
  const tone = status === 'CONNECTED' ? 'success' : status === 'SANDBOX' ? 'info' : status === 'READY_TO_CONFIGURE' ? 'warning' : 'info';
  return <StatusBadge tone={tone}>{categoryLabel(status)}</StatusBadge>;
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/40">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-navy md:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{detail}</p>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className="mb-2 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
