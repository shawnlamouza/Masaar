import { useEffect, useState, type FormEvent } from 'react';
import type { OrderStatus, PublicOrder } from '@masaar/contracts';
import { Button, Skeleton, StatusBadge } from '@masaar/ui';
import {
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { getPublicConfirmation, submitPublicConfirmation } from './api';

const GOVERNORATES = [
  'Beirut',
  'Mount Lebanon',
  'North Lebanon',
  'Akkar',
  'Bekaa',
  'Baalbek-Hermel',
  'South Lebanon',
  'Nabatieh',
] as const;
const formatMoney = (order: PublicOrder) =>
  order.totals.grandTotal.currency === 'USD'
    ? `$${(order.totals.grandTotal.amountMinor / 100).toFixed(2)}`
    : `${Math.round(order.totals.grandTotal.amountMinor).toLocaleString()} LBP`;

export function CustomerConfirmationPage({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    governorate: 'Beirut',
    area: '',
    locality: '',
    street: '',
    building: '',
    floor: '',
    landmark: '',
    mapUrl: '',
    deliveryNotes: '',
  });
  useEffect(() => {
    getPublicConfirmation(token)
      .then((value) => {
        setOrder(value);
        setForm((current) => ({
          ...current,
          name: value.customerName,
          phone: value.customerPhone,
        }));
        if (value.status !== 'PENDING_CUSTOMER_CONFIRMATION') setDone(true);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Unable to open this link.'),
      );
  }, [token]);
  useEffect(() => {
    if (
      !done ||
      !order ||
      ['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status)
    )
      return;
    const timer = window.setInterval(() => {
      getPublicConfirmation(token)
        .then(setOrder)
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [done, order?.status, token]);
  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => setForm({ ...form, [name]: event.target.value }),
    };
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setOrder(await submitPublicConfirmation(token, form));
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not confirm the address.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tech-grid min-h-screen bg-[#edf6f4] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[30px] border border-white bg-white shadow-2xl md:grid md:grid-cols-[.72fr_1.28fr]">
        <aside className="relative min-h-64 overflow-hidden bg-brand-navy p-6 text-white md:min-h-full">
          <img
            src="/brand/masaar-poster-dark.jpg"
            alt="Masaar smart tools for Lebanese businesses"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/20 to-brand-navy/95" />
          <div className="relative flex h-full flex-col">
            <img
              src="/brand/masaar-logo-dark.png"
              alt="Masaar"
              className="size-14 rounded-2xl object-cover"
            />
            <div className="mt-auto pt-32">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
                Customer confirmation
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold">
                No account. No repeated chat copying.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Your details go directly into the business order, exactly where the team needs them.
              </p>
              <div className="mt-5 flex items-center gap-2 text-xs text-brand-teal">
                <ShieldCheck className="size-4" /> Secure, expiring order link
              </div>
            </div>
          </div>
        </aside>
        <section className="p-6 md:p-10">
          {error && !order ? (
            <div className="rounded-2xl bg-danger-soft p-5 text-danger-strong">
              <h2 className="font-display text-xl font-bold">This link cannot be opened</h2>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          ) : !order ? (
            <>
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="mt-4 h-32" />
              <Skeleton className="mt-4 h-64" />
            </>
          ) : done ? (
            <div className="flex min-h-[580px] flex-col items-center justify-center text-center">
              <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success-strong">
                <CheckCircle2 className="size-10" />
              </span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-brand-teal-deep">
                Secure customer tracking
              </p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-brand-navy">
                Thank you, {order.customerName}.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
                {order.businessName} has the confirmed details for {order.orderNumber}. Keep this
                secure link to see the latest status without creating an account.
              </p>
              <div className="mt-7 w-full max-w-xl rounded-2xl border border-border bg-surface-muted p-5 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <StatusBadge
                      tone={
                        order.status === 'DELIVERED'
                          ? 'success'
                          : ['FAILED', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status)
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {order.status.toLowerCase().replaceAll('_', ' ')}
                    </StatusBadge>
                    <p className="mt-3 font-display text-2xl font-bold text-brand-navy">
                      {formatMoney(order)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {order.paymentMethod === 'CASH'
                        ? 'Cash due according to order payment details'
                        : order.paymentMethod}
                    </p>
                  </div>
                  <button
                    onClick={() => void getPublicConfirmation(token).then(setOrder)}
                    className="clickable-surface flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-bold text-brand-navy"
                  >
                    <RefreshCw className="size-3.5 text-brand-teal-deep" /> Refresh
                  </button>
                </div>
                <TrackingRail status={order.status} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-deep">
                    {order.businessName}
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-brand-navy">
                    Confirm your delivery details
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">Order {order.orderNumber}</p>
                </div>
                <div className="rounded-2xl bg-brand-gold-soft px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-warning-strong">
                    Order total
                  </p>
                  <strong className="font-display text-xl text-brand-navy">
                    {formatMoney(order)}
                  </strong>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="size-5 text-brand-teal-deep" />
                  <strong className="text-sm text-brand-navy">What you ordered</strong>
                </div>
                <div className="mt-3 space-y-2">
                  {order.items.map((line) => (
                    <div key={line.id} className="flex justify-between text-xs">
                      <span>
                        {line.quantity}× {line.productName} {line.variantLabel}
                      </span>
                      <span className="font-bold">{line.sku}</span>
                    </div>
                  ))}
                </div>
              </div>
              <form className="mt-7 space-y-5" onSubmit={submit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label icon={Phone} text="Full name">
                    <input required {...field('name')} className="field" />
                  </Label>
                  <Label icon={Phone} text="Phone number">
                    <input required {...field('phone')} className="field" />
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label icon={MapPin} text="Governorate">
                    <select {...field('governorate')} className="field">
                      {GOVERNORATES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Label>
                  <Label icon={MapPin} text="Area / district">
                    <input required {...field('area')} placeholder="e.g. Metn" className="field" />
                  </Label>
                </div>
                <Label icon={MapPin} text="Town / locality">
                  <input
                    required
                    {...field('locality')}
                    placeholder="e.g. Antelias"
                    className="field"
                  />
                </Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label text="Street">
                    <input {...field('street')} className="field" />
                  </Label>
                  <Label text="Building">
                    <input {...field('building')} className="field" />
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label text="Floor">
                    <input {...field('floor')} className="field" />
                  </Label>
                  <Label text="Nearby landmark">
                    <input {...field('landmark')} placeholder="Opposite…" className="field" />
                  </Label>
                </div>
                <Label icon={MapPin} text="Google Maps link (optional)">
                  <input
                    {...field('mapUrl')}
                    placeholder="Paste a map pin link"
                    className="field"
                  />
                </Label>
                <Label text="Delivery notes">
                  <textarea
                    {...field('deliveryNotes')}
                    rows={3}
                    placeholder="Call before arriving, gate color…"
                    className="field"
                  />
                </Label>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-strong"
                  >
                    {error}
                  </p>
                )}
                <Button disabled={busy} className="min-h-14 w-full text-base">
                  {busy ? 'Confirming…' : 'Confirm order and address'}
                  <CheckCircle2 className="size-5" />
                </Button>
                <p className="flex items-center justify-center gap-2 text-center text-[11px] text-ink-muted">
                  <Clock3 className="size-3.5" /> Link expires{' '}
                  {new Date(order.confirmationExpiresAt).toLocaleDateString()}
                </p>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function TrackingRail({ status }: { status: OrderStatus }) {
  const steps: Array<{ label: string; statuses: OrderStatus[] }> = [
    { label: 'Confirmed', statuses: ['CONFIRMED'] },
    { label: 'Preparing', statuses: ['PREPARING', 'PACKED'] },
    { label: 'Dispatch', statuses: ['READY_FOR_DISPATCH', 'ASSIGNED_TO_DELIVERY'] },
    { label: 'On the way', statuses: ['OUT_FOR_DELIVERY'] },
    { label: 'Delivered', statuses: ['DELIVERED'] },
  ];
  const current = Math.max(
    0,
    steps.findIndex((step) => step.statuses.includes(status)),
  );
  const exception = ['FAILED', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(status);
  if (exception)
    return (
      <div className="mt-5 rounded-xl bg-warning-soft p-3 text-xs leading-5 text-warning-strong">
        The business recorded this order as{' '}
        <strong>{status.toLowerCase().replaceAll('_', ' ')}</strong>. Contact the business directly
        if you need clarification or another attempt.
      </div>
    );
  return (
    <div className="mt-6">
      <div className="relative flex justify-between">
        <div className="absolute left-4 right-4 top-4 h-0.5 bg-border" />
        <div
          className="absolute left-4 top-4 h-0.5 bg-brand-teal transition-all"
          style={{
            width: `calc(${(current / (steps.length - 1)) * 100}% - ${current ? 2 : 0}rem)`,
          }}
        />
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="relative z-10 flex w-16 flex-col items-center text-center"
          >
            <span
              className={`grid size-8 place-items-center rounded-full border-2 ${index <= current ? 'border-brand-teal bg-brand-teal text-white' : 'border-border bg-white text-ink-muted'}`}
            >
              {index === steps.length - 1 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Truck className="size-3.5" />
              )}
            </span>
            <span
              className={`mt-2 text-[9px] font-bold ${index <= current ? 'text-brand-navy' : 'text-ink-muted'}`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[10px] text-ink-muted">
        Updates automatically every 30 seconds while the order is active.
      </p>
    </div>
  );
}

function Label({
  icon: Icon,
  text,
  children,
}: {
  icon?: typeof Phone;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
        {Icon && <Icon className="size-3.5 text-brand-teal-deep" />}
        {text}
      </span>
      {children}
    </label>
  );
}
