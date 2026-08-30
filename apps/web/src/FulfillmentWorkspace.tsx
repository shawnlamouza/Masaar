import { useEffect, useState, type FormEvent } from 'react';
import type {
  CreateReconciliation,
  DeliveryFailureReason,
  DriverCommand,
  DriverStop,
  FulfillmentSnapshot,
  PaymentMethod,
  Role,
} from '@masaar/contracts';
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '@masaar/ui';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
  Smartphone,
  Truck,
  WalletCards,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  approveCashReconciliation,
  assignDelivery,
  createCashReconciliation,
  getDriverStops,
  getDriverWallet,
  getFulfillmentSnapshot,
  listOrders,
  recordPaymentEntry,
  sendDriverCommand,
} from './api';

type Mode = 'Delivery' | 'Money';
const METHODS: PaymentMethod[] = ['CASH', 'WHISH', 'OMT', 'CARD', 'BANK', 'OTHER'];
const FAILURES: DeliveryFailureReason[] = [
  'UNREACHABLE',
  'CUSTOMER_UNAVAILABLE',
  'CUSTOMER_REFUSED',
  'INCORRECT_ADDRESS',
  'ACCESS_OR_WEATHER',
  'DAMAGED_PARCEL',
  'DRIVER_OR_COURIER_ISSUE',
  'OTHER',
];
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
const formatMoney = (minor: number, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? `$${(minor / 100).toFixed(2)}` : `${Math.round(minor).toLocaleString()} LBP`;
const inputToMinor = (value: string, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? Math.round(Number(value) * 100) : Math.round(Number(value));
const minorToInput = (minor: number, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? (minor / 100).toFixed(2) : String(Math.round(minor));
const inputClass =
  'h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-brand-navy outline-none transition focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10';

export function FulfillmentWorkspace({ role, mode }: { role: Role; mode: Mode }) {
  if (role === 'DRIVER') return <DriverWorkspace role={role} />;
  return mode === 'Delivery' ? <DeliveryCommand role={role} /> : <MoneyCommand role={role} />;
}

function DeliveryCommand({ role }: { role: Role }) {
  const [snapshot, setSnapshot] = useState<FulfillmentSnapshot | null>(null);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listOrders>>>([]);
  const [resourceId, setResourceId] = useState('usr_driver');
  const [zoneId, setZoneId] = useState('zone_metn');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  async function reload() {
    const [next, nextOrders] = await Promise.all([getFulfillmentSnapshot(role), listOrders(role)]);
    setSnapshot(next);
    setOrders(nextOrders);
  }
  useEffect(() => {
    void reload();
  }, [role]);
  const ready = orders.filter((order) => ['READY_FOR_DISPATCH', 'FAILED'].includes(order.status));
  async function assign(orderId: string) {
    setBusy(orderId);
    setMessage('');
    try {
      await assignDelivery(role, {
        orderId,
        resourceId,
        zoneId,
        reason: 'Dispatch desk assignment',
      });
      await reload();
      setMessage('Delivery assigned and a new attempt was created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assignment failed.');
    } finally {
      setBusy('');
    }
  }
  if (!snapshot) return <WorkspaceSkeleton />;
  const active = snapshot.deliveries.filter((item) =>
    ['ASSIGNED', 'IN_PROGRESS'].includes(item.status),
  );
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <Hero
        eyebrow="Lebanese last-mile control"
        title="Dispatch without losing the trail."
        detail="Own drivers, freelancers and courier companies share one attempt history. A failed stop remains visible, keeps its reason, and can be reassigned without erasing what happened."
        icon={Route}
        stats={[
          `${active.length} active stops`,
          `${snapshot.resources.length} delivery resources`,
          `${snapshot.zones.length} priced zones`,
        ]}
      />
      {message && <Notice text={message} />}
      <div className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
        <section>
          <SectionTitle
            kicker="Assignment console"
            title="Ready for dispatch"
            detail="Choose who carries the parcel and which Lebanese fee zone applies."
          />
          <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-ink-muted">
              Delivery resource
              <select
                className={`${inputClass} mt-1`}
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value)}
              >
                {snapshot.resources
                  .filter((item) => item.active)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {label(item.type)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Fee zone
              <select
                className={`${inputClass} mt-1`}
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
              >
                {snapshot.zones
                  .filter((item) => item.active)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} ·{' '}
                      {formatMoney(item.customerFee.amountMinor, item.customerFee.currency)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="space-y-3">
            {ready.length ? (
              ready.map((order) => (
                <Card
                  key={order.id}
                  className="group overflow-hidden border-l-4 border-l-brand-gold transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold text-brand-navy">
                          {order.orderNumber}
                        </span>
                        <StatusBadge tone={order.status === 'FAILED' ? 'danger' : 'success'}>
                          {label(order.status)}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-brand-navy">
                        {order.customerName} ·{' '}
                        {order.deliveryAddress?.locality ?? 'Address missing'}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s) ·
                        Collect {formatMoney(order.totals.amountDue.amountMinor, order.currency)}
                      </p>
                    </div>
                    <Button disabled={busy === order.id} onClick={() => void assign(order.id)}>
                      {order.status === 'FAILED' ? 'Create retry' : 'Assign stop'}{' '}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={<PackageCheck className="size-6" />}
                title="Nothing waiting at dispatch"
                detail="Orders appear here after packing is completed."
              />
            )}
          </div>
        </section>
        <section>
          <SectionTitle
            kicker="Live manifest"
            title="What is moving now"
            detail="Every card is a delivery case with its own immutable attempts."
          />
          <div className="space-y-3">
            {snapshot.deliveries.map((delivery) => (
              <Card
                key={delivery.id}
                className={
                  delivery.status === 'FAILED' ? 'border-danger-strong/25 bg-danger-soft/30' : ''
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-brand-navy">
                      {delivery.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {delivery.resourceName} → {delivery.zoneName}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      delivery.status === 'FAILED'
                        ? 'danger'
                        : delivery.status === 'COMPLETED'
                          ? 'success'
                          : 'info'
                    }
                  >
                    {label(delivery.status)}
                  </StatusBadge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Attempt" value={`#${delivery.attempts.at(-1)?.number ?? 1}`} />
                  <Mini
                    label="Collect"
                    value={formatMoney(
                      delivery.expectedCollection.amountMinor,
                      delivery.expectedCollection.currency,
                    )}
                  />
                  <Mini
                    label="Cost"
                    value={formatMoney(
                      delivery.businessCost.amountMinor,
                      delivery.businessCost.currency,
                    )}
                  />
                </div>
                {delivery.attempts.at(-1)?.failureReason && (
                  <p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-danger-strong">
                    {label(delivery.attempts.at(-1)!.failureReason!)} ·{' '}
                    {delivery.attempts.at(-1)?.note}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      </div>
      <section>
        <SectionTitle
          kicker="Delivery network"
          title="Resources and fee zones"
          detail="Pricing and responsibility are explicit before the parcel leaves."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {snapshot.resources.map((resource) => (
            <Card key={resource.id}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-teal-soft text-brand-teal-deep">
                  <Truck className="size-5" />
                </span>
                <div>
                  <p className="font-bold text-brand-navy">{resource.name}</p>
                  <p className="text-xs text-ink-muted">{label(resource.type)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-muted">
                Coverage: {resource.serviceAreas.join(', ')}
              </p>
              <p className="mt-1 text-xs font-semibold text-brand-navy">
                {resource.settlementTerms}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function MoneyCommand({ role }: { role: Role }) {
  const [snapshot, setSnapshot] = useState<FulfillmentSnapshot | null>(null);
  const [paymentOrder, setPaymentOrder] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [paymentHolderId, setPaymentHolderId] = useState('usr_driver');
  const [reconciliationKey, setReconciliationKey] = useState('');
  const [returned, setReturned] = useState('');
  const [explanation, setExplanation] = useState('');
  const [message, setMessage] = useState('');
  async function reload() {
    const value = await getFulfillmentSnapshot(role);
    setSnapshot(value);
    if (!paymentOrder && value.payments[0]) setPaymentOrder(value.payments[0].orderId);
    if (!reconciliationKey && value.cashPositions[0])
      setReconciliationKey(`${value.cashPositions[0].holderId}:${value.cashPositions[0].currency}`);
  }
  useEffect(() => {
    void reload();
  }, [role]);
  if (!snapshot) return <WorkspaceSkeleton />;
  const currentSnapshot = snapshot;
  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    const projection = currentSnapshot.payments.find((item) => item.orderId === paymentOrder);
    if (!projection) return;
    const holder = currentSnapshot.resources.find((item) => item.id === paymentHolderId);
    try {
      await recordPaymentEntry(role, {
        orderId: paymentOrder,
        type: 'COLLECTION',
        method,
        status: 'POSTED',
        amountMinor: inputToMinor(amount, projection.currency),
        currency: projection.currency,
        reference,
        occurredAt: new Date().toISOString(),
        ...(method === 'CASH'
          ? { holderId: holder?.id ?? 'business_cash', holderName: holder?.name ?? 'Business cash' }
          : {}),
      });
      setAmount('');
      setReference('');
      setMessage('Payment posted. Delivery status was not changed.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment failed.');
    }
  }
  async function reconcile(event: FormEvent) {
    event.preventDefault();
    const position = currentSnapshot.cashPositions.find(
      (item) => `${item.holderId}:${item.currency}` === reconciliationKey,
    );
    if (!position) return;
    const holder = currentSnapshot.resources.find((item) => item.id === position.holderId);
    const input: CreateReconciliation = {
      holderId: position.holderId,
      holderName: holder?.name ?? position.holderName,
      currency: position.currency,
      returnedMinor: inputToMinor(returned, position.currency),
      explanation,
    };
    try {
      await createCashReconciliation(role, input);
      setReturned('');
      setExplanation('');
      setMessage('Reconciliation submitted; any discrepancy remains visible until owner approval.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reconciliation failed.');
    }
  }
  async function approve(id: string) {
    try {
      await approveCashReconciliation(
        role,
        id,
        'Owner reviewed the count and accepted the recorded handover.',
      );
      setMessage('Handover approved and cash custody updated.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Approval failed.');
    }
  }
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <Hero
        eyebrow="Money truth, not delivery assumptions"
        title="Know who holds every dollar."
        detail="Cash, Whish, OMT and bank payments live in a payment ledger separate from delivery. Cash adds a second truth: the person physically holding it until an approved handover."
        icon={WalletCards}
        stats={[
          `${snapshot.dailyClose.unresolvedPayments} unresolved payments`,
          `${snapshot.cashPositions.length} cash positions`,
          `${snapshot.dailyClose.openDiscrepancies} discrepancies open`,
        ]}
      />
      {message && <Notice text={message} />}
      <div className="flex items-start gap-3 rounded-2xl border border-info-strong/15 bg-info-soft p-4 text-sm text-info-strong">
        <CircleDollarSign className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>Normal delivery payments are automatic.</strong> When the assigned driver marks a
          stop Delivered and enters Cash, Whish or another method, Masaar posts the payment and
          assigns cash custody immediately. The form below is only for prepaid transfers, counter
          payments, courier statements, refunds or corrections made outside that driver action.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.cashPositions.length ? (
          snapshot.cashPositions.map((position) => (
            <Card
              key={`${position.holderId}${position.currency}`}
              className="relative overflow-hidden"
            >
              <div className="absolute -right-5 -top-5 size-24 rounded-full bg-brand-gold/10" />
              <Banknote className="size-5 text-brand-gold" />
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
                Cash held by
              </p>
              <p className="mt-1 font-display text-lg font-bold text-brand-navy">
                {position.holderName}
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-brand-teal-deep">
                {formatMoney(position.amount.amountMinor, position.currency)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {position.movementCount} ledger movements
              </p>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<WalletCards className="size-6" />}
            title="No cash outside the register"
            detail="Cash custody appears as soon as a collection is posted."
          />
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle
            kicker="Payment ledger"
            title="External payment or correction"
            detail="Use only when money arrived outside the normal driver-delivery flow."
          />
          <form
            onSubmit={(event) => void submitPayment(event)}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Order
              <select
                className={`${inputClass} mt-1`}
                value={paymentOrder}
                onChange={(event) => setPaymentOrder(event.target.value)}
              >
                {snapshot.payments.map((item) => (
                  <option key={item.orderId} value={item.orderId}>
                    {item.orderNumber} · {label(item.state)} · due{' '}
                    {formatMoney(item.balance.amountMinor, item.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Method
              <select
                className={`${inputClass} mt-1`}
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              >
                {METHODS.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Amount
              <input
                required
                min={
                  currentSnapshot.payments.find((item) => item.orderId === paymentOrder)
                    ?.currency === 'USD'
                    ? '0.01'
                    : '1'
                }
                step={
                  currentSnapshot.payments.find((item) => item.orderId === paymentOrder)
                    ?.currency === 'USD'
                    ? '0.01'
                    : '1000'
                }
                className={`${inputClass} mt-1`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            {method === 'CASH' && (
              <label className="text-xs font-bold text-ink-muted sm:col-span-2">
                Cash holder
                <select
                  className={`${inputClass} mt-1`}
                  value={paymentHolderId}
                  onChange={(event) => setPaymentHolderId(event.target.value)}
                >
                  {snapshot.resources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Reference or proof note
              <input
                className={`${inputClass} mt-1`}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Whish transaction, receipt or COD note"
              />
            </label>
            <Button className="sm:col-span-2">
              Add external payment <CheckCircle2 className="size-4" />
            </Button>
          </form>
        </Card>
        <Card>
          <SectionTitle
            kicker="Reconciliation engine"
            title="Compare expected vs returned"
            detail="Shortages and overages require an explanation; only an owner or manager can accept the handover."
          />
          <form
            onSubmit={(event) => void reconcile(event)}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Holder
              <select
                className={`${inputClass} mt-1`}
                value={reconciliationKey}
                onChange={(event) => setReconciliationKey(event.target.value)}
              >
                {snapshot.cashPositions.map((item) => (
                  <option
                    key={`${item.holderId}${item.currency}`}
                    value={`${item.holderId}:${item.currency}`}
                  >
                    {item.holderName} · expected{' '}
                    {formatMoney(item.amount.amountMinor, item.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Actually returned
              <input
                required
                min="0"
                step={
                  currentSnapshot.cashPositions.find(
                    (item) => `${item.holderId}:${item.currency}` === reconciliationKey,
                  )?.currency === 'USD'
                    ? '0.01'
                    : '1000'
                }
                className={`${inputClass} mt-1`}
                value={returned}
                onChange={(event) => setReturned(event.target.value)}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Explanation when different
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-brand-teal"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Example: $5 customer change paid from collected cash"
              />
            </label>
            <Button className="sm:col-span-2">
              Submit cash count <ShieldCheck className="size-4" />
            </Button>
          </form>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <SectionTitle
            kicker="Order/payment separation"
            title="Delivery and payment are different truths"
            detail="A Delivered order can still be Pending or Partially Paid."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-3">Order</th>
                  <th>Payment</th>
                  <th>Collected</th>
                  <th>Balance</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.payments.map((item) => (
                  <tr className="border-t border-line" key={item.orderId}>
                    <td className="py-3 font-bold text-brand-navy">{item.orderNumber}</td>
                    <td>
                      <StatusBadge
                        tone={
                          item.state === 'PAID'
                            ? 'success'
                            : item.state === 'PARTIALLY_PAID'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {label(item.state)}
                      </StatusBadge>
                    </td>
                    <td>{formatMoney(item.collected.amountMinor, item.currency)}</td>
                    <td className="font-bold">
                      {formatMoney(item.balance.amountMinor, item.currency)}
                    </td>
                    <td>{item.entries.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="bg-brand-navy text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
            Daily closing report
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{snapshot.dailyClose.date}</p>
          <div className="mt-6 space-y-3">
            <CloseLine
              label="Delivered orders"
              value={String(snapshot.dailyClose.deliveredOrders)}
            />
            <CloseLine
              label="Unresolved payments"
              value={String(snapshot.dailyClose.unresolvedPayments)}
            />
            <CloseLine
              label="Open discrepancies"
              value={String(snapshot.dailyClose.openDiscrepancies)}
            />
            {snapshot.dailyClose.collectionsByMethod.map((item) => (
              <CloseLine
                key={`${item.method}${item.amount.currency}`}
                label={`${item.method} collected`}
                value={formatMoney(item.amount.amountMinor, item.amount.currency)}
              />
            ))}
          </div>
        </Card>
      </div>
      {snapshot.reconciliations.length > 0 && (
        <section>
          <SectionTitle
            kicker="Approval queue"
            title="Cash handovers and discrepancies"
            detail="The original expected amount, actual return and explanation are never overwritten."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {snapshot.reconciliations.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-brand-navy">{item.holderName}</p>
                    <p className="text-xs text-ink-muted">
                      Expected {formatMoney(item.expected.amountMinor, item.currency)} · returned{' '}
                      {formatMoney(item.returned.amountMinor, item.currency)}
                    </p>
                  </div>
                  <StatusBadge tone={item.status === 'DISCREPANCY_REVIEW' ? 'danger' : 'success'}>
                    {label(item.status)}
                  </StatusBadge>
                </div>
                <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">
                  Variance:{' '}
                  <strong>
                    {formatMoney(Math.abs(item.variance.amountMinor), item.currency)}{' '}
                    {item.variance.amountMinor < 0
                      ? 'short'
                      : item.variance.amountMinor > 0
                        ? 'over'
                        : 'matched'}
                  </strong>
                  {item.explanation ? ` · ${item.explanation}` : ''}
                </p>
                {!['CLOSED', 'APPROVED'].includes(item.status) && (
                  <Button
                    disabled={!['OWNER', 'MANAGER'].includes(role)}
                    className="mt-3 w-full"
                    onClick={() => void approve(item.id)}
                  >
                    {['OWNER', 'MANAGER'].includes(role)
                      ? 'Approve handover'
                      : 'Owner approval required'}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type Queued = { id: string; command: DriverCommand };
type DriverCache = {
  stops: DriverStop[];
  wallet: Awaited<ReturnType<typeof getDriverWallet>>;
  savedAt: string;
};

function readDriverCache(): DriverCache | null {
  try {
    return JSON.parse(
      localStorage.getItem('masaar.driver.route-cache') ?? 'null',
    ) as DriverCache | null;
  } catch {
    return null;
  }
}

function DriverWorkspace({ role }: { role: Role }) {
  const [initialCache] = useState(readDriverCache);
  const [stops, setStops] = useState<DriverStop[]>(initialCache?.stops ?? []);
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof getDriverWallet>>>(
    initialCache?.wallet ?? [],
  );
  const [cachedAt, setCachedAt] = useState(initialCache?.savedAt ?? '');
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const offline = !networkOnline || simulateOffline;
  const [queue, setQueue] = useState<Queued[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('masaar.driver.outbox') ?? '[]') as Queued[];
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<DriverStop | null>(null);
  const [action, setAction] = useState<'DELIVERED' | 'FAILED'>('DELIVERED');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [failure, setFailure] = useState<DeliveryFailureReason>('CUSTOMER_UNAVAILABLE');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState(
    initialCache && !navigator.onLine
      ? 'Showing the last saved route. New actions will wait safely in the outbox.'
      : '',
  );
  async function reload() {
    try {
      const [nextStops, nextWallet] = await Promise.all([
        getDriverStops(role),
        getDriverWallet(role),
      ]);
      const savedAt = new Date().toISOString();
      setStops(nextStops);
      setWallet(nextWallet);
      setCachedAt(savedAt);
      localStorage.setItem(
        'masaar.driver.route-cache',
        JSON.stringify({ stops: nextStops, wallet: nextWallet, savedAt } satisfies DriverCache),
      );
    } catch {
      setMessage(
        initialCache
          ? 'Connection unavailable. Masaar kept the last saved route and will queue new actions.'
          : 'Connection unavailable and no route has been saved on this device yet.',
      );
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    const online = () => setNetworkOnline(true);
    const offline = () => setNetworkOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem('masaar.driver.outbox', JSON.stringify(queue));
  }, [queue]);
  async function execute(command: DriverCommand) {
    const queueLocally = () => {
      setQueue((current) => [...current, { id: command.commandId, command }]);
      setStops((current) =>
        command.action === 'OUT_FOR_DELIVERY'
          ? current.map((stop) =>
              stop.delivery.id === command.deliveryId
                ? { ...stop, delivery: { ...stop.delivery, status: 'IN_PROGRESS' } }
                : stop,
            )
          : current.filter((stop) => stop.delivery.id !== command.deliveryId),
      );
      setMessage('Saved offline. Sync will send this action exactly once.');
    };
    if (offline) {
      queueLocally();
      return;
    }
    try {
      await sendDriverCommand(role, command);
      setMessage('Stop updated and synced.');
      await reload();
    } catch {
      queueLocally();
    }
  }
  async function sync() {
    if (offline) return;
    const remaining: Queued[] = [];
    for (const item of queue) {
      try {
        await sendDriverCommand(role, item.command);
      } catch {
        remaining.push(item);
      }
    }
    setQueue(remaining);
    setMessage(
      remaining.length
        ? `${remaining.length} action(s) still waiting.`
        : 'Offline actions synced exactly once.',
    );
    await reload();
  }
  async function begin(stop: DriverStop) {
    await execute({
      commandId: crypto.randomUUID(),
      deliveryId: stop.delivery.id,
      action: 'OUT_FOR_DELIVERY',
      occurredAt: new Date().toISOString(),
      note: 'Driver departed for stop.',
    });
  }
  async function finish(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const command: DriverCommand = {
      commandId: crypto.randomUUID(),
      deliveryId: selected.delivery.id,
      action,
      occurredAt: new Date().toISOString(),
      note,
      ...(action === 'FAILED'
        ? { failureReason: failure }
        : {
            payment: {
              method,
              amountMinor: inputToMinor(amount || '0', selected.order.amountToCollect.currency),
              currency: selected.order.amountToCollect.currency,
              reference: '',
            },
          }),
    };
    await execute(command);
    setSelected(null);
    setAmount('');
    setNote('');
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Hero
        eyebrow="Driver mobile route"
        title="Only the next action matters."
        detail="Addresses, calls, collection amounts and delivery actions stay large and simple. Actions can be queued during an outage and replay safely when the connection returns."
        icon={Smartphone}
        stats={[
          `${stops.length} active stops`,
          `${queue.length} waiting to sync`,
          `${wallet.length} cash wallet(s)`,
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3">
        <button
          onClick={() => setSimulateOffline((value) => !value)}
          disabled={!networkOnline}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${offline ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}`}
        >
          {offline ? <WifiOff className="size-4" /> : <CheckCircle2 className="size-4" />}
          {!networkOnline ? 'No connection' : simulateOffline ? 'Offline simulation' : 'Connected'}
        </button>
        <Button
          variant="secondary"
          disabled={offline || queue.length === 0}
          onClick={() => void sync()}
        >
          <RefreshCw className="size-4" /> Sync {queue.length || ''}
        </Button>
      </div>
      {cachedAt && (
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          Route saved on this device · {new Date(cachedAt).toLocaleString()}
        </p>
      )}
      {message && <Notice text={message} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {wallet.map((item) => (
          <Card key={item.currency} className="bg-brand-navy text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
              Cash in your custody
            </p>
            <p className="mt-2 font-display text-3xl font-bold">
              {formatMoney(item.amount.amountMinor, item.currency)}
            </p>
            <p className="mt-1 text-xs text-white/55">The owner sees the same amount.</p>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {stops.length ? (
          stops.map((stop, index) => (
            <Card key={stop.delivery.id} className="overflow-hidden p-0">
              <div className="bg-brand-navy px-5 py-3 text-white">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                    Stop {index + 1} · {stop.delivery.zoneName}
                  </p>
                  <StatusBadge tone="info">{label(stop.delivery.status)}</StatusBadge>
                </div>
              </div>
              <div className="p-5">
                <p className="font-display text-2xl font-bold text-brand-navy">
                  {stop.customer.name}
                </p>
                <p className="mt-2 flex gap-2 text-sm leading-6 text-ink-muted">
                  <MapPin className="mt-1 size-4 shrink-0 text-brand-teal" />
                  {stop.customer.address}
                </p>
                {stop.customer.notes && (
                  <p className="mt-2 rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning-strong">
                    {stop.customer.notes}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={`tel:${stop.customer.phone}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-bold text-brand-navy"
                  >
                    <Phone className="size-4" /> Call
                  </a>
                  {stop.customer.mapUrl ? (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={stop.customer.mapUrl}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-bold text-brand-navy"
                    >
                      Map <ExternalLink className="size-4" />
                    </a>
                  ) : (
                    <div className="grid place-items-center rounded-xl bg-surface-muted text-xs text-ink-muted">
                      No map pin
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-2xl bg-brand-teal-soft p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-teal-deep">
                    Amount still to collect
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold text-brand-navy">
                    {formatMoney(
                      stop.order.amountToCollect.amountMinor,
                      stop.order.amountToCollect.currency,
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Payment: {label(stop.order.paymentState)}
                  </p>
                </div>
                {stop.delivery.status === 'ASSIGNED' ? (
                  <Button className="mt-4 w-full" onClick={() => void begin(stop)}>
                    Out for delivery <Truck className="size-4" />
                  </Button>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => {
                        setSelected(stop);
                        setAction('DELIVERED');
                        setAmount(
                          minorToInput(
                            stop.order.amountToCollect.amountMinor,
                            stop.order.amountToCollect.currency,
                          ),
                        );
                      }}
                    >
                      Delivered <PackageCheck className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(stop);
                        setAction('FAILED');
                      }}
                    >
                      Failed <XCircle className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<Route className="size-6" />}
            title="Route clear"
            detail="No assigned stops remain on this driver's manifest."
          />
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-brand-navy/65 p-3 sm:place-items-center">
          <Card className="w-full max-w-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                  Close stop
                </p>
                <h2 className="font-display text-2xl font-bold text-brand-navy">
                  {selected.order.orderNumber}
                </h2>
              </div>
              <button onClick={() => setSelected(null)}>
                <XCircle className="size-6 text-ink-muted" />
              </button>
            </div>
            <form onSubmit={(event) => void finish(event)} className="mt-5 space-y-3">
              {action === 'DELIVERED' ? (
                <>
                  <label className="text-xs font-bold text-ink-muted">
                    Payment method
                    <select
                      className={`${inputClass} mt-1`}
                      value={method}
                      onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                    >
                      {METHODS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-ink-muted">
                    Amount actually collected
                    <input
                      className={`${inputClass} mt-1`}
                      min="0"
                      step={selected.order.amountToCollect.currency === 'USD' ? '0.01' : '1000'}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <p className="text-xs text-ink-muted">
                    Enter 0 if delivered but unpaid. Masaar will keep payment Pending.
                  </p>
                </>
              ) : (
                <label className="text-xs font-bold text-ink-muted">
                  Why did delivery fail?
                  <select
                    className={`${inputClass} mt-1`}
                    value={failure}
                    onChange={(event) => setFailure(event.target.value as DeliveryFailureReason)}
                  >
                    {FAILURES.map((item) => (
                      <option key={item} value={item}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-xs font-bold text-ink-muted">
                Note
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-line p-3 text-sm"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <Button className="w-full">
                Save {action === 'DELIVERED' ? 'delivery' : 'failed attempt'}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function Hero({
  eyebrow,
  title,
  detail,
  icon: Icon,
  stats,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  icon: typeof Truck;
  stats: string[];
}) {
  return (
    <section className="tech-grid relative overflow-hidden rounded-[30px] bg-brand-navy p-7 text-white shadow-2xl md:p-10">
      <div className="absolute -right-16 -top-16 size-72 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
            <Icon className="size-4" />
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-.035em] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">{detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-bold text-white/80"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
function SectionTitle({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{detail}</p>
    </div>
  );
}
function Mini({ label: title, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted p-2">
      <p className="text-[10px] font-bold uppercase text-ink-muted">{title}</p>
      <p className="mt-1 text-xs font-bold text-brand-navy">{value}</p>
    </div>
  );
}
function Notice({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-brand-teal/20 bg-brand-teal-soft px-4 py-3 text-sm font-semibold text-brand-teal-deep"
    >
      <CheckCircle2 className="size-4 shrink-0" />
      {text}
    </div>
  );
}
function CloseLine({ label: title, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-sm">
      <span className="text-white/55">{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
function WorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Skeleton className="h-72 rounded-[30px]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
