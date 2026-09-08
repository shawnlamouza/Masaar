import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  Customer,
  DeliveryZone,
  FulfillmentMethod,
  Order,
  OrderSource,
  OrderStatus,
  Product,
  QuickOrder,
  Role,
} from '@masaar/contracts';
import { STAFF_ORDER_TRANSITIONS } from '@masaar/contracts';
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  Clipboard,
  Clock3,
  Instagram,
  MessageCircle,
  NotebookPen,
  PackageCheck,
  ShoppingBag,
  Plus,
  Search,
  Sparkles,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import {
  ApiError,
  addOrderNote,
  bulkTransitionOrders,
  cancelOrder,
  copyOrderMessage,
  createOrder,
  getCommerceSnapshot,
  getFulfillmentSnapshot,
  listOrders,
  transitionOrder,
} from './api';

const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  {
    status: 'PENDING_CUSTOMER_CONFIRMATION',
    title: 'Waiting on customer',
    accent: 'bg-brand-gold',
  },
  { status: 'CONFIRMED', title: 'Confirmed', accent: 'bg-info-strong' },
  { status: 'PREPARING', title: 'Preparing', accent: 'bg-brand-teal' },
  { status: 'PACKED', title: 'Packed', accent: 'bg-success-strong' },
  { status: 'READY_FOR_DISPATCH', title: 'Ready', accent: 'bg-brand-navy' },
];
const BOARD_STATUSES = new Set<OrderStatus>(COLUMNS.map((column) => column.status));
const ACTIVE_STATUSES = new Set<OrderStatus>([
  ...BOARD_STATUSES,
  'ASSIGNED_TO_DELIVERY',
  'OUT_FOR_DELIVERY',
  'FAILED',
]);
const DELIVERY_AND_HISTORY_STATUSES: OrderStatus[] = [
  'ASSIGNED_TO_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
];
const STAGE_GUIDE = [
  { label: 'Waiting on customer', owner: 'Order created' },
  { label: 'Confirmed', owner: 'Customer action' },
  { label: 'Preparing', owner: 'Team action' },
  { label: 'Packed', owner: 'Team action' },
  { label: 'Ready', owner: 'Team action' },
  { label: 'Assigned', owner: 'Dispatch action' },
  { label: 'Out for delivery', owner: 'Driver action' },
  { label: 'Delivered', owner: 'Driver action' },
] as const;

const SOURCES: OrderSource[] = [
  'INSTAGRAM',
  'WHATSAPP',
  'FACEBOOK',
  'TIKTOK',
  'WEBSITE',
  'PHONE',
  'STORE',
];
const FULFILLMENT_OPTIONS: {
  value: FulfillmentMethod;
  title: string;
  detail: string;
}[] = [
  {
    value: 'DELIVERY',
    title: 'Deliver to customer',
    detail: 'Send a secure address confirmation, then assign a driver or courier.',
  },
  {
    value: 'CUSTOMER_PICKUP',
    title: 'Customer pickup',
    detail: 'Prepare the order, then record the counter handover and payment.',
  },
  {
    value: 'IN_STORE',
    title: 'In-store sale',
    detail: 'Customer is present; complete payment and handover without delivery.',
  },
];
const formatStatus = (status: string) =>
  status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
const displayOrderStatus = (order: Order) => {
  if (order.status === 'READY_FOR_DISPATCH' && order.fulfillmentMethod === 'CUSTOMER_PICKUP')
    return 'Ready for pickup';
  if (order.status === 'DELIVERED' && order.fulfillmentMethod === 'CUSTOMER_PICKUP')
    return 'Collected';
  if (order.status === 'DELIVERED' && order.fulfillmentMethod === 'IN_STORE')
    return 'Completed in store';
  if (order.status === 'CONFIRMED' && order.fulfillmentMethod !== 'DELIVERY')
    return 'Confirmed in person';
  return formatStatus(order.status);
};
const money = (minor: number, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? `$${(minor / 100).toFixed(2)}` : `${Math.round(minor).toLocaleString()} LBP`;
const inputToMinor = (value: string, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? Math.round(Number(value) * 100) : Math.round(Number(value));
const nextBoardStatus = (status: OrderStatus) => STAFF_ORDER_TRANSITIONS[status][0];
const staffActionLabel = (status: OrderStatus) =>
  status === 'CONFIRMED'
    ? 'Start preparing'
    : status === 'PREPARING'
      ? 'Finish preparation → Packed'
      : status === 'PACKED'
        ? 'Finish packing → Ready for dispatch'
        : '';
const actionOwnedStatusHelp = (order: Order) => {
  const status = order.status;
  if (status === 'PENDING_CUSTOMER_CONFIRMATION')
    return 'Waiting for the customer to submit the secure confirmation link; staff cannot confirm it for them.';
  if (status === 'READY_FOR_DISPATCH')
    return order.fulfillmentMethod === 'DELIVERY'
      ? 'Choose a driver or delivery company and zone in Fulfillment; a successful assignment changes this status automatically.'
      : 'Open Fulfillment to record the physical customer handover and any counter payment.';
  if (status === 'ASSIGNED_TO_DELIVERY')
    return 'The assigned driver changes this to Out for Delivery when the physical trip begins.';
  if (status === 'OUT_FOR_DELIVERY')
    return 'The driver must record Delivered or Failed, including collection or failure details.';
  if (status === 'DELIVERED' || status === 'FAILED')
    return 'Any after-sales change must begin as a documented case in Returns & Exchanges.';
  return 'This status is historical and cannot be changed from the Orders board.';
};

export function OrdersWorkspace({
  role,
  initialSearch = '',
}: {
  role: Role;
  initialSearch?: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [quickOpen, setQuickOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Order | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'ALL' | OrderStatus>('ALL');
  const [historySort, setHistorySort] = useState<'NEWEST' | 'OLDEST' | 'STATUS'>('NEWEST');
  const canWrite = role !== 'READ_ONLY' && role !== 'DRIVER';

  async function reload() {
    const [nextOrders, commerce, fulfillment] = await Promise.all([
      listOrders(role, search),
      getCommerceSnapshot(role),
      getFulfillmentSnapshot(role),
    ]);
    setOrders(nextOrders);
    setProducts(commerce.products);
    setCustomers(commerce.customers);
    setZones(fulfillment.zones.filter((zone) => zone.active));
    setLoading(false);
  }
  useEffect(() => {
    void reload();
  }, [role]);
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);
  useEffect(() => {
    const handle = window.setTimeout(() => void listOrders(role, search).then(setOrders), 250);
    return () => window.clearTimeout(handle);
  }, [role, search]);

  function replace(updated: Order) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setDetail((current) => (current?.id === updated.id ? updated : current));
  }

  async function bulkAdvance() {
    const candidates = orders.filter((order) => selected.includes(order.id));
    const next = candidates[0] ? nextBoardStatus(candidates[0].status) : undefined;
    if (!next || candidates.some((order) => nextBoardStatus(order.status) !== next)) return;
    const changed = await bulkTransitionOrders(role, selected, next);
    changed.forEach(replace);
    setSelected([]);
  }

  const selectedOrders = orders.filter((order) => selected.includes(order.id));
  const sharedNext = selectedOrders[0] ? nextBoardStatus(selectedOrders[0].status) : undefined;
  const canBulkAdvance = Boolean(
    sharedNext && selectedOrders.every((order) => nextBoardStatus(order.status) === sharedNext),
  );
  const laterOrders = orders.filter((order) => !BOARD_STATUSES.has(order.status));
  const boardOrderCount = orders.filter((order) => BOARD_STATUSES.has(order.status)).length;
  const deliveryOrderCount = orders.filter((order) =>
    ['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'FAILED'].includes(order.status),
  ).length;
  const visibleLaterOrders = [...laterOrders]
    .filter((order) => historyStatus === 'ALL' || order.status === historyStatus)
    .sort((a, b) =>
      historySort === 'STATUS'
        ? a.status.localeCompare(b.status)
        : historySort === 'OLDEST'
          ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="depth-stage relative overflow-hidden rounded-[28px] bg-brand-navy p-6 text-white md:p-8">
        <div className="absolute inset-0 tech-grid opacity-70" />
        <div className="absolute -right-20 -top-24 size-64 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
              <Sparkles className="size-4" /> Social commerce control room
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Every order has a next move.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Capture the sale once, let the customer confirm the address, then give every employee
              a clear stage and responsibility.
            </p>
          </div>
          {canWrite && (
            <Button
              onClick={() => setQuickOpen(true)}
              className="gold-action min-h-12 border border-white/15 text-brand-navy"
            >
              <Plus className="size-5" /> Quick order
            </Button>
          )}
        </div>
        <div className="relative mt-7 grid gap-2 sm:grid-cols-3">
          <Pulse
            label="Active across workflow"
            value={orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length.toString()}
            detail={`${boardOrderCount} processing + ${deliveryOrderCount} delivery/retry cases`}
          />
          <Pulse
            label="Waiting on customer"
            value={orders
              .filter((order) => order.status === 'PENDING_CUSTOMER_CONFIRMATION')
              .length.toString()}
            detail="confirmation links pending"
          />
          <Pulse
            label="Ready to dispatch"
            value={orders
              .filter((order) => order.status === 'READY_FOR_DISPATCH')
              .length.toString()}
            detail="awaiting dispatch assignment"
          />
        </div>
        <div className="relative mt-4 flex items-center overflow-x-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          {STAGE_GUIDE.map((stage, index) => (
            <div key={stage.label} className="flex min-w-fit flex-1 items-center">
              <span className="grid size-7 place-items-center rounded-full border border-brand-teal/40 bg-brand-teal/15 text-[10px] font-extrabold text-brand-teal">
                {index + 1}
              </span>
              <span className="ml-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/85">
                  {stage.label}
                </span>
                <span className="block text-[8px] font-semibold text-brand-teal/80">
                  {stage.owner}
                </span>
              </span>
              {index < STAGE_GUIDE.length - 1 && (
                <span className="mx-3 h-px min-w-5 flex-1 bg-gradient-to-r from-brand-teal/60 to-brand-gold/40" />
              )}
            </div>
          ))}
        </div>
        <div className="relative mt-3 grid gap-2 text-[10px] font-semibold sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
            <strong className="text-brand-gold">Delivery:</strong> customer confirms → team prepares
            → dispatch assigns → driver completes
          </div>
          <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/10 px-3 py-2 text-white/70">
            <strong className="text-brand-teal">Pickup:</strong> staff confirms in person → team
            prepares → counter handover
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
            <strong className="text-white">In store:</strong> staff confirms in person → counter
            payment and handover
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            aria-label="Search orders"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find order, customer, phone or SKU…"
            className="min-h-11 w-full rounded-xl bg-surface-muted pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-teal-soft"
          />
        </div>
        <span className="rounded-xl bg-brand-teal-soft px-3 py-2 text-xs font-bold text-brand-teal-deep">
          {orders.length} total orders
        </span>
        {selected.length > 0 && (
          <>
            <span className="text-xs font-semibold text-ink-muted">{selected.length} selected</span>
            <Button
              variant="secondary"
              disabled={!canBulkAdvance}
              onClick={() => void bulkAdvance()}
            >
              <CheckCheck className="size-4" /> Move to{' '}
              {sharedNext ? formatStatus(sharedNext) : 'next stage'}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {COLUMNS.map(({ status }) => (
            <Skeleton key={status} className="h-96" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<PackageCheck />}
            title="No matching orders"
            detail="Create a quick order or clear the search."
          />
        </div>
      ) : search.trim() ? (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-gold">
                Search results
              </p>
              <h2 className="font-display text-xl font-bold text-brand-navy">
                Across every order status
              </h2>
            </div>
            <button
              className="text-xs font-bold text-brand-teal-deep"
              onClick={() => setSearch('')}
            >
              Clear search
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                checked={selected.includes(order.id)}
                canWrite={canWrite}
                onCheck={() =>
                  setSelected((current) =>
                    current.includes(order.id)
                      ? current.filter((id) => id !== order.id)
                      : [...current, order.id],
                  )
                }
                onOpen={() => setDetail(order)}
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="mt-6 grid items-start gap-4 overflow-x-auto pb-4 lg:grid-cols-5">
            {COLUMNS.map((column) => {
              const items = orders.filter((order) => order.status === column.status);
              return (
                <section
                  key={column.status}
                  className="min-w-[260px] rounded-2xl border border-border bg-[#eef3f5]/80 p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${column.accent}`} />
                      <h2 className="text-xs font-extrabold uppercase tracking-[.12em] text-brand-navy">
                        {column.title}
                      </h2>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-ink-muted">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        checked={selected.includes(order.id)}
                        canWrite={canWrite}
                        onCheck={() =>
                          setSelected((current) =>
                            current.includes(order.id)
                              ? current.filter((id) => id !== order.id)
                              : [...current, order.id],
                          )
                        }
                        onOpen={() => setDetail(order)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border bg-white/50 p-5 text-center text-xs text-ink-muted">
                        No orders here
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {laterOrders.length > 0 && (
            <section className="mt-6 rounded-[24px] border border-border bg-white p-4 shadow-card sm:p-5">
              <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-gold">
                    Delivery and history
                  </p>
                  <h2 className="font-display text-xl font-bold text-brand-navy">
                    Every dispatched, completed and exception order
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Assigned, out-for-delivery, delivered, failed, cancelled, returned and refunded
                    records remain visible here.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Filter order history"
                    value={historyStatus}
                    onChange={(event) =>
                      setHistoryStatus(event.target.value as 'ALL' | OrderStatus)
                    }
                    className="field min-h-10 py-2 text-xs"
                  >
                    <option value="ALL">All delivery and history ({laterOrders.length})</option>
                    {DELIVERY_AND_HISTORY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)} (
                        {laterOrders.filter((order) => order.status === status).length})
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Sort order history"
                    value={historySort}
                    onChange={(event) => setHistorySort(event.target.value as typeof historySort)}
                    className="field min-h-10 py-2 text-xs"
                  >
                    <option value="NEWEST">Newest activity first</option>
                    <option value="OLDEST">Oldest activity first</option>
                    <option value="STATUS">Group by status</option>
                  </select>
                  <span className="rounded-xl bg-brand-navy px-3 py-2.5 text-xs font-bold text-white">
                    {visibleLaterOrders.length} shown
                  </span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleLaterOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    checked={selected.includes(order.id)}
                    canWrite={canWrite}
                    onCheck={() =>
                      setSelected((current) =>
                        current.includes(order.id)
                          ? current.filter((id) => id !== order.id)
                          : [...current, order.id],
                      )
                    }
                    onOpen={() => setDetail(order)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {quickOpen && (
        <QuickOrderPanel
          role={role}
          products={products}
          customers={customers}
          zones={zones}
          onClose={() => setQuickOpen(false)}
          onCreated={(order) => {
            setOrders((current) => [order, ...current]);
          }}
        />
      )}
      {detail && (
        <OrderDetail
          role={role}
          order={detail}
          canWrite={canWrite}
          onClose={() => setDetail(null)}
          onUpdate={replace}
        />
      )}
    </div>
  );
}

function Pulse({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/7 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_8px_22px_rgba(0,0,0,.12)] backdrop-blur">
      <p className="text-xs font-semibold text-white/55">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <strong className="font-display text-3xl text-white">{value}</strong>
        <span className="pb-1 text-[11px] text-brand-teal">{detail}</span>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  checked,
  canWrite,
  onCheck,
  onOpen,
}: {
  order: Order;
  checked: boolean;
  canWrite: boolean;
  onCheck: () => void;
  onOpen: () => void;
}) {
  const tone =
    order.status === 'PENDING_CUSTOMER_CONFIRMATION'
      ? 'warning'
      : order.status === 'READY_FOR_DISPATCH'
        ? 'success'
        : 'info';
  return (
    <article
      className={`clickable-surface group rounded-2xl border bg-white p-4 shadow-sm ${order.status === 'FAILED' || order.status === 'CANCELLED' ? 'border-danger-strong/25' : order.status === 'DELIVERED' ? 'border-success-strong/20' : order.status === 'REFUNDED' || order.status === 'RETURNED' ? 'border-brand-gold/35' : 'border-transparent'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="group/open text-left">
          <span className="font-display text-sm font-bold text-brand-navy">
            {order.orderNumber}
          </span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-brand-teal-deep">
            {order.source} ·{' '}
            {order.fulfillmentMethod === 'DELIVERY'
              ? 'Delivery'
              : order.fulfillmentMethod === 'CUSTOMER_PICKUP'
                ? 'Pickup'
                : 'In store'}
          </span>
        </button>
        {canWrite && nextBoardStatus(order.status) && (
          <button
            aria-label={`Select ${order.orderNumber}`}
            onClick={onCheck}
            className={`grid size-6 place-items-center rounded-lg border ${checked ? 'border-brand-teal bg-brand-teal text-white' : 'border-border text-transparent'}`}
          >
            <Check className="size-3.5" />
          </button>
        )}
      </div>
      <button onClick={onOpen} className="mt-4 w-full text-left">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">{order.customerName}</p>
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-teal-soft text-brand-teal-deep opacity-65 transition group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            <ArrowRight className="size-3.5" />
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">{order.customerPhone}</p>
        <div className="my-3 h-px bg-border" />
        <div className="space-y-1.5">
          {order.items.slice(0, 2).map((line) => (
            <div key={line.id} className="flex justify-between text-xs">
              <span className="truncate text-ink-muted">
                {line.quantity}× {line.productName}
              </span>
              <span className="font-bold text-ink">{line.sku}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <StatusBadge tone={tone}>
            {order.status === 'PENDING_CUSTOMER_CONFIRMATION'
              ? 'Needs reply'
              : displayOrderStatus(order)}
          </StatusBadge>
          <strong className="font-display text-base text-brand-navy">
            {money(order.totals.grandTotal.amountMinor, order.currency)}
          </strong>
        </div>
      </button>
    </article>
  );
}

function QuickOrderPanel({
  role,
  products,
  customers,
  zones,
  onClose,
  onCreated,
}: {
  role: Role;
  products: Product[];
  customers: Customer[];
  zones: DeliveryZone[];
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const variants = products.flatMap((product) =>
    product.variants
      .filter((variant) => product.active && variant.available)
      .map((variant) => ({ product, variant })),
  );
  const [source, setSource] = useState<OrderSource>('INSTAGRAM');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('DELIVERY');
  const [staffConfirmedInPerson, setStaffConfirmedInPerson] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lines, setLines] = useState([{ variantId: variants[0]?.variant.id ?? '', quantity: 1 }]);
  const [deliveryFee, setDeliveryFee] = useState('4');
  const [deliveryZoneId, setDeliveryZoneId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [prepaid, setPrepaid] = useState('0');
  const [payment, setPayment] = useState<'CASH' | 'WHISH'>('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const preview = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const selected = variants.find(({ variant }) => variant.id === line.variantId);
        return sum + (selected?.variant.currentSellingPrice.amountMinor ?? 0) * line.quantity;
      }, 0),
    [lines, variants],
  );
  const currency =
    variants.find(({ variant }) => variant.id === lines[0]?.variantId)?.variant.currentSellingPrice
      .currency ?? 'USD';
  useEffect(() => {
    setDeliveryFee((current) =>
      current === '4' || current === '400000' ? (currency === 'USD' ? '4' : '400000') : current,
    );
  }, [currency]);
  const compatibleZones = zones.filter((zone) => zone.customerFee.currency === currency);
  useEffect(() => {
    if (deliveryZoneId && !compatibleZones.some((zone) => zone.id === deliveryZoneId))
      setDeliveryZoneId('');
  }, [currency, deliveryZoneId, compatibleZones]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const input: QuickOrder = {
      source,
      fulfillmentMethod,
      staffConfirmedInPerson,
      ...(customerId ? { customerId } : {}),
      customerName: name,
      customerPhone: phone,
      items: lines,
      discountType: 'FIXED',
      discountValue: inputToMinor(discount, currency),
      deliveryFeeMinor: fulfillmentMethod === 'DELIVERY' ? inputToMinor(deliveryFee, currency) : 0,
      ...(fulfillmentMethod === 'DELIVERY' && deliveryZoneId ? { deliveryZoneId } : {}),
      prepaidMinor: inputToMinor(prepaid, currency),
      paymentMethod: payment,
      tags: [],
      note,
      ...(duplicateReason ? { duplicateOverrideReason: duplicateReason } : {}),
    };
    try {
      const result = await createOrder(role, input);
      setCreatedLink(result.confirmationUrl ?? '');
      setCreatedOrderNumber(result.order.orderNumber);
      onCreated(result.order);
      setLinkCopied(result.confirmationUrl ? await copyText(result.confirmationUrl) : false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create order.');
      if (reason instanceof ApiError && reason.status === 409)
        setDuplicateReason('Customer confirmed this is a separate order');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-brand-navy/65 backdrop-blur-sm"
    >
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl md:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-deep">
              Under one minute
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-navy">Quick order</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Masaar snapshots catalog prices and calculates the total on the server.
            </p>
          </div>
          <button
            aria-label="Close quick order"
            onClick={onClose}
            className="clickable-surface rounded-xl border border-transparent bg-surface-muted p-2 hover:border-brand-teal/25"
          >
            <X />
          </button>
        </div>
        {createdOrderNumber && (
          <div className="mt-6 rounded-2xl border border-success-strong/15 bg-success-soft p-5 text-success-strong">
            <strong>{createdOrderNumber} created successfully.</strong>
            <p className="mt-1 text-sm">
              {fulfillmentMethod === 'DELIVERY'
                ? linkCopied
                  ? 'The secure delivery-confirmation link is on your clipboard.'
                  : 'Clipboard access was blocked; use the copy button below.'
                : fulfillmentMethod === 'CUSTOMER_PICKUP'
                  ? 'The customer was confirmed in person. Prepare it, mark it ready, then complete pickup in Fulfillment.'
                  : 'The customer was confirmed in person. Complete payment and handover in Fulfillment.'}
            </p>
            {createdLink && <p className="mt-1 break-all text-xs">{createdLink}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {createdLink && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copyText(createdLink).then(setLinkCopied)}
                >
                  <Clipboard className="size-4" /> Copy secure link
                </Button>
              )}
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
        {!createdOrderNumber && (
          <form className="mt-7 space-y-6" onSubmit={submit}>
            <fieldset>
              <legend className="text-sm font-bold text-brand-navy">
                1. How will the customer receive it?
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {FULFILLMENT_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setFulfillmentMethod(option.value)}
                    className={`clickable-surface rounded-2xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-lg ${fulfillmentMethod === option.value ? 'border-brand-teal bg-brand-teal-soft shadow-[inset_0_1px_0_white,0_8px_0_-4px_rgba(0,168,156,.4)]' : 'border-border bg-white'}`}
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-navy text-brand-gold">
                      {option.value === 'DELIVERY' ? (
                        <ArrowRight className="size-4" />
                      ) : (
                        <ShoppingBag className="size-4" />
                      )}
                    </span>
                    <strong className="mt-3 block text-sm text-brand-navy">{option.title}</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-ink-muted">
                      {option.detail}
                    </span>
                  </button>
                ))}
              </div>
              {fulfillmentMethod !== 'DELIVERY' && (
                <label className="mt-3 flex items-start gap-3 rounded-2xl border border-brand-teal/20 bg-brand-teal-soft/45 p-4 text-xs font-semibold leading-5 text-brand-teal-deep">
                  <input
                    required
                    type="checkbox"
                    checked={staffConfirmedInPerson}
                    onChange={(event) => setStaffConfirmedInPerson(event.target.checked)}
                    className="mt-1 size-4"
                  />
                  I confirm the customer directly approved this{' '}
                  {fulfillmentMethod === 'CUSTOMER_PICKUP' ? 'pickup order' : 'in-store sale'}. This
                  staff action replaces the delivery-address confirmation link and is recorded in
                  the audit timeline.
                </label>
              )}
            </fieldset>
            <fieldset>
              <legend className="text-sm font-bold text-brand-navy">
                2. Where did the order start?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {SOURCES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setSource(item)}
                    className={`rounded-full border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-sm ${source === item ? 'border-brand-teal bg-brand-teal-soft text-brand-teal-deep shadow-[inset_0_1px_0_white,0_4px_0_-2px_rgba(0,168,156,.28)]' : 'border-border bg-white text-ink-muted'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="Use an existing customer or enter a new one">
              <select
                value={customerId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setCustomerId(nextId);
                  const customer = customers.find((item) => item.id === nextId);
                  if (!customer) {
                    setName('');
                    setPhone('');
                    return;
                  }
                  setName(customer.name);
                  setPhone(customer.phoneOriginal);
                  setPayment(customer.preferredPaymentMethod === 'WHISH' ? 'WHISH' : 'CASH');
                }}
                className="field"
              >
                <option value="">New customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phoneNormalized}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer name">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jana Khoury"
                  className="field"
                />
              </Field>
              <Field label="Lebanese phone">
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="70 123 456"
                  className="field"
                />
              </Field>
            </div>
            <fieldset>
              <div className="flex items-center justify-between">
                <legend className="text-sm font-bold text-brand-navy">
                  3. Products and variants
                </legend>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setLines([...lines, { variantId: variants[0]?.variant.id ?? '', quantity: 1 }])
                  }
                >
                  <Plus className="size-4" /> Add line
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_90px_40px] gap-2">
                    <select
                      aria-label={`Product ${index + 1}`}
                      value={line.variantId}
                      onChange={(e) =>
                        setLines(
                          lines.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, variantId: e.target.value } : item,
                          ),
                        )
                      }
                      className="field"
                    >
                      {variants.map(({ product, variant }) => (
                        <option key={variant.id} value={variant.id}>
                          {product.name} · {variantLabel(variant.size, variant.color)} ·{' '}
                          {variant.sku} ·{' '}
                          {money(
                            variant.currentSellingPrice.amountMinor,
                            variant.currentSellingPrice.currency,
                          )}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Quantity ${index + 1}`}
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, quantity: Number(e.target.value) }
                              : item,
                          ),
                        )
                      }
                      className="field"
                    />
                    <button
                      type="button"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-xl text-ink-muted disabled:opacity-20"
                    >
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-3">
              {fulfillmentMethod === 'DELIVERY' && (
                <Field label="Delivery fee zone">
                  <select
                    value={deliveryZoneId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setDeliveryZoneId(id);
                      const selected = compatibleZones.find((zone) => zone.id === id);
                      if (selected)
                        setDeliveryFee(
                          selected.customerFee.currency === 'USD'
                            ? (selected.customerFee.amountMinor / 100).toFixed(2)
                            : String(selected.customerFee.amountMinor),
                        );
                    }}
                    className="field"
                  >
                    <option value="">Manual fee</option>
                    {compatibleZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} ·{' '}
                        {money(zone.customerFee.amountMinor, zone.customerFee.currency)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {fulfillmentMethod === 'DELIVERY' && (
                <Field label={`Delivery fee (${currency})`}>
                  <input
                    type="number"
                    min="0"
                    step={currency === 'USD' ? '0.01' : '1000'}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="field"
                  />
                </Field>
              )}
              <Field label={`Discount (${currency})`}>
                <input
                  type="number"
                  min="0"
                  step={currency === 'USD' ? '0.01' : '1000'}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="field"
                />
              </Field>
              <Field label={`Already paid (${currency})`}>
                <input
                  type="number"
                  min="0"
                  step={currency === 'USD' ? '0.01' : '1000'}
                  value={prepaid}
                  onChange={(e) => setPrepaid(e.target.value)}
                  className="field"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payment method">
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as 'CASH' | 'WHISH')}
                  className="field"
                >
                  <option value="CASH">
                    {fulfillmentMethod === 'DELIVERY' ? 'Cash on delivery' : 'Cash at counter'}
                  </option>
                  <option value="WHISH">Whish</option>
                </select>
              </Field>
              <Field label="Internal note">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Gift wrap, priority…"
                  className="field"
                />
              </Field>
            </div>
            {duplicateReason && (
              <div className="rounded-2xl border border-warning-strong/20 bg-warning-soft p-4">
                <p className="text-sm font-bold text-warning-strong">Possible duplicate detected</p>
                <p className="mt-1 text-xs text-warning-strong">
                  Review the warning above. Submit again only if this is genuinely separate.
                </p>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-strong"
              >
                <AlertTriangle className="mr-2 inline size-4" />
                {error}
              </p>
            )}
            <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-white py-4">
              <div>
                <p className="text-xs text-ink-muted">Preview before fees</p>
                <strong className="font-display text-2xl text-brand-navy">
                  {money(preview, currency)}
                </strong>
              </div>
              <Button disabled={busy || !variants.length} className="min-h-12">
                {busy
                  ? 'Creating…'
                  : fulfillmentMethod === 'DELIVERY'
                    ? 'Create & copy confirmation'
                    : fulfillmentMethod === 'CUSTOMER_PICKUP'
                      ? 'Create pickup order'
                      : 'Create in-store sale'}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
function variantLabel(size?: string, color?: string) {
  return [size, color].filter(Boolean).join(' · ');
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based browser fallback.
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

function OrderDetail({
  role,
  order,
  canWrite,
  onClose,
  onUpdate,
}: {
  role: Role;
  order: Order;
  canWrite: boolean;
  onClose: () => void;
  onUpdate: (order: Order) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const next = nextBoardStatus(order.status);
  const canCancel = [
    'PENDING_CUSTOMER_CONFIRMATION',
    'CONFIRMED',
    'PREPARING',
    'PACKED',
    'READY_FOR_DISPATCH',
    'ASSIGNED_TO_DELIVERY',
  ].includes(order.status);
  async function advance() {
    if (!next) return;
    setBusy(true);
    try {
      onUpdate(await transitionOrder(role, order.id, next, 'Completed from the operations board.'));
    } finally {
      setBusy(false);
    }
  }
  async function saveNote() {
    if (!note.trim()) return;
    onUpdate(await addOrderNote(role, order.id, note));
    setNote('');
  }
  async function confirmCancellation() {
    if (cancelReason.trim().length < 5) return;
    setBusy(true);
    try {
      onUpdate(await cancelOrder(role, order.id, cancelReason.trim()));
      setCancelling(false);
      setCancelReason('');
    } finally {
      setBusy(false);
    }
  }
  async function copy(template: 'CONFIRMATION' | 'REMINDER' | 'STATUS') {
    const result = await copyOrderMessage(role, order.id, template);
    const copied = await copyText(result.text);
    onUpdate(result.order);
    setToast(
      copied
        ? `${template === 'STATUS' ? 'Status + tracking' : formatStatus(template)} message copied`
        : 'Message prepared, but browser clipboard access was blocked.',
    );
    window.setTimeout(() => setToast(''), 1800);
  }
  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-brand-navy/65 backdrop-blur-sm"
    >
      <section className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-brand-teal-deep">
                {order.orderNumber} · {order.source}
              </p>
              <h2 className="font-display text-2xl font-bold text-brand-navy">
                {order.customerName}
              </h2>
              <p className="text-sm text-ink-muted">{order.customerPhone}</p>
            </div>
            <button
              aria-label="Close order details"
              onClick={onClose}
              className="rounded-xl bg-surface-muted p-2"
            >
              <X />
            </button>
          </div>
          {canWrite && next && (
            <Button onClick={() => void advance()} disabled={busy} className="mt-4 w-full">
              {staffActionLabel(order.status)} <ArrowRight className="size-4" />
            </Button>
          )}
          {canWrite && !next && !['CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status) && (
            <p className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal-soft/60 p-3 text-xs font-semibold leading-5 text-brand-teal-deep">
              {actionOwnedStatusHelp(order)}
            </p>
          )}
        </div>
        <div className="space-y-6 p-5">
          {toast && (
            <div
              role="status"
              className="rounded-xl bg-success-soft p-3 text-sm font-bold text-success-strong"
            >
              {toast}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Info icon={UserRound} label="Customer" value={order.customerName} />
            <Info icon={Clock3} label="Current stage" value={displayOrderStatus(order)} />
            <Info
              icon={PackageCheck}
              label="Amount due"
              value={money(order.totals.amountDue.amountMinor, order.currency)}
            />
            <Info icon={Instagram} label="Source" value={formatStatus(order.source)} />
            <Info
              icon={ShoppingBag}
              label="Fulfillment"
              value={
                order.fulfillmentMethod === 'CUSTOMER_PICKUP'
                  ? 'Customer pickup'
                  : formatStatus(order.fulfillmentMethod)
              }
            />
          </div>
          {canWrite && canCancel && (
            <div className="rounded-2xl border border-danger-strong/15 bg-danger-soft/30 p-4">
              {!cancelling ? (
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-bold text-brand-navy">Need to cancel?</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Cancellation requires a reason and releases reserved stock. Any collected
                      money must still be refunded in Payments.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="border-danger-strong/25 text-danger-strong"
                    onClick={() => setCancelling(true)}
                  >
                    Cancel order
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-brand-navy">
                    Cancellation reason
                    <textarea
                      autoFocus
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      className="field mt-1 min-h-20"
                      placeholder="Example: Customer cancelled before dispatch"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      disabled={busy || cancelReason.trim().length < 5}
                      className="bg-danger-strong hover:bg-danger-strong"
                      onClick={() => void confirmCancellation()}
                    >
                      Confirm cancellation
                    </Button>
                    <Button variant="ghost" onClick={() => setCancelling(false)}>
                      Keep order
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <Card className="shadow-none">
            <h3 className="font-display text-lg font-bold text-brand-navy">Items & money</h3>
            <div className="mt-3 space-y-3">
              {order.items.map((line) => (
                <div key={line.id} className="flex justify-between text-sm">
                  <span>
                    {line.quantity}× {line.productName}{' '}
                    <span className="text-ink-muted">{line.variantLabel}</span>
                  </span>
                  <strong>{money(line.lineTotal.amountMinor, order.currency)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>
                  {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'No delivery fee'}
                </span>
                <span>{money(order.totals.deliveryFee.amountMinor, order.currency)}</span>
              </div>
              <div className="mt-2 flex justify-between font-bold text-brand-navy">
                <span>Total</span>
                <span>{money(order.totals.grandTotal.amountMinor, order.currency)}</span>
              </div>
            </div>
          </Card>
          {canWrite && (
            <Card className="shadow-none">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-brand-teal-deep" />
                <h3 className="font-display font-bold text-brand-navy">WhatsApp tools</h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {order.fulfillmentMethod === 'DELIVERY'
                  ? 'Confirmation and reminder messages contain a secure address link; every copy is audited.'
                  : 'This order was confirmed in person. A status message can still share its secure tracking view.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.fulfillmentMethod === 'DELIVERY' && (
                  <>
                    <Button variant="secondary" onClick={() => void copy('CONFIRMATION')}>
                      <Clipboard className="size-4" /> Confirmation
                    </Button>
                    <Button variant="secondary" onClick={() => void copy('REMINDER')}>
                      Reminder
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={() => void copy('STATUS')}>
                  Status + tracking
                </Button>
              </div>
            </Card>
          )}
          <Card className="shadow-none">
            <div className="flex items-center gap-2">
              <NotebookPen className="size-5 text-brand-teal-deep" />
              <h3 className="font-display font-bold text-brand-navy">Internal notes</h3>
            </div>
            {order.notes.map((item) => (
              <div key={item.id} className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">
                <p>{item.text}</p>
                <p className="mt-1 text-[10px] text-ink-muted">
                  {item.authorName} · {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {canWrite && (
              <div className="mt-3 flex gap-2">
                <input
                  aria-label="New internal note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a handoff note…"
                  className="field"
                />
                <Button onClick={() => void saveNote()}>Add</Button>
              </div>
            )}
          </Card>
          <Card className="shadow-none">
            <div className="flex items-center gap-2">
              <Tags className="size-5 text-brand-teal-deep" />
              <h3 className="font-display font-bold text-brand-navy">Timeline & accountability</h3>
            </div>
            <ol className="mt-4 space-y-4">
              {[...order.timeline].reverse().map((event) => (
                <li key={event.id} className="relative border-l-2 border-brand-teal-soft pl-4">
                  <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-brand-teal" />
                  <p className="text-sm font-bold text-ink">{event.message}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">
                    {event.actorName} · {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-muted p-3">
      <Icon className="size-4 text-brand-teal-deep" />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-brand-navy">{value}</p>
    </div>
  );
}
