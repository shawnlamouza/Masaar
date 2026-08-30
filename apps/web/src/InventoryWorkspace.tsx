import { useEffect, useState, type FormEvent } from 'react';
import type {
  InventorySnapshot,
  InventoryStockItem,
  Order,
  ReturnCase,
  Role,
} from '@masaar/contracts';
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Warehouse,
  X,
} from 'lucide-react';
import {
  adjustStock,
  createReturnCase,
  getCommerceSnapshot,
  getInventorySnapshot,
  listOrders,
  receiveReturnCase,
  recordStockReceipt,
  resolveReturnCase,
  type CommerceSnapshot,
} from './api';

export type InventoryView = 'Stock Control' | 'Returns';

type WorkspaceData = {
  inventory: InventorySnapshot;
  orders: Order[];
  commerce: CommerceSnapshot;
};

const field =
  'min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-brand-navy outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal-soft';

const formatMoney = (amountMinor: number, currency: 'USD' | 'LBP') =>
  currency === 'USD'
    ? `$${(amountMinor / 100).toFixed(2)}`
    : `${Math.round(amountMinor).toLocaleString()} LBP`;

export function InventoryWorkspace({ view, role }: { view: InventoryView; role: Role }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    setError('');
    Promise.all([getInventorySnapshot(role), listOrders(role), getCommerceSnapshot(role)])
      .then(([inventory, orders, commerce]) => {
        if (live) setData({ inventory, orders, commerce });
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : 'Inventory could not load.');
      });
    return () => {
      live = false;
    };
  }, [role, refreshKey]);

  if (error)
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={<AlertTriangle />} title="Inventory could not load" detail={error} />
        <Button className="mt-4" onClick={() => setRefreshKey((value) => value + 1)}>
          <RefreshCw className="size-4" /> Retry
        </Button>
      </div>
    );
  if (!data) return <InventoryLoading />;
  const refresh = () => setRefreshKey((value) => value + 1);
  return (
    <div className="mx-auto max-w-[1450px]">
      {view === 'Stock Control' ? (
        <StockControl data={data} role={role} refresh={refresh} />
      ) : (
        <ReturnsControl data={data} role={role} refresh={refresh} />
      )}
    </div>
  );
}

function StockControl({
  data,
  role,
  refresh,
}: {
  data: WorkspaceData;
  role: Role;
  refresh: () => void;
}) {
  const [dialog, setDialog] = useState<'RECEIPT' | 'ADJUST' | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(data.inventory.items[0]?.variantId ?? '');
  const summary = data.inventory.summary;
  const writable = !['READ_ONLY', 'DRIVER'].includes(role);
  const restock =
    summary.suggestedRestockByCurrency
      .map((item) => formatMoney(item.amountMinor, item.currency))
      .join(' + ') || 'No urgent spend';
  return (
    <>
      <PageHeader
        eyebrow="Inventory truth"
        title="Stock Control"
        detail="See what is physically on hand, what customer orders have reserved, and what can still be sold. Every change keeps its source and reason."
        actions={
          writable ? (
            <div className="flex flex-wrap gap-2">
              {(role === 'OWNER' || role === 'MANAGER') && (
                <Button variant="secondary" onClick={() => setDialog('ADJUST')}>
                  <ClipboardCheck className="size-4" /> Physical count
                </Button>
              )}
              <Button onClick={() => setDialog('RECEIPT')}>
                <PackagePlus className="size-4" /> Receive stock
              </Button>
            </div>
          ) : undefined
        }
      />
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={Warehouse}
          label="On hand"
          value={`${summary.unitsOnHand}`}
          detail="Physical sellable units"
        />
        <Stat
          icon={ShieldCheck}
          label="Reserved"
          value={`${summary.unitsReserved}`}
          detail="Protected for confirmed orders"
        />
        <Stat
          icon={PackageCheck}
          label="Available"
          value={`${summary.unitsAvailable}`}
          detail="Safe to promise now"
        />
        <Stat
          icon={TrendingDown}
          label="Low or out"
          value={`${summary.lowStockVariants + summary.outOfStockVariants}`}
          detail="Needs a decision"
          warning={summary.lowStockVariants + summary.outOfStockVariants > 0}
        />
        <Stat
          icon={ArrowDownToLine}
          label="Suggested restock"
          value={restock}
          detail="Editable estimate, never automatic"
          priority={summary.lowStockVariants + summary.outOfStockVariants > 0}
        />
      </section>
      <Card className="depth-stage mt-5 overflow-hidden border-0 bg-brand-navy text-white">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
              <Sparkles className="size-4" /> Stock & Supplier Radar
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Buy enough to survive the lead time—not enough to trap your cash.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
              Suggestions combine recent sold units, the supplier’s Lebanese lead time, minimum
              order quantity, current availability and unit cost. You remain in control of every
              receipt.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4 text-right">
            <p className="text-xs text-white/50">Cash exposure now</p>
            <strong className="mt-1 block font-display text-xl text-brand-teal">{restock}</strong>
          </div>
        </div>
      </Card>
      {data.inventory.items.length ? (
        <div className="surface-card mt-6 overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1.35fr_.72fr_.72fr_.72fr_.9fr_1.15fr_1fr] gap-3 border-b border-border bg-surface-muted px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted lg:grid">
            <span>Product / SKU</span>
            <span>On hand</span>
            <span>Reserved</span>
            <span>Available</span>
            <span>Cover</span>
            <span>Supplier</span>
            <span>Decision</span>
          </div>
          {data.inventory.items.map((item) => (
            <StockRow
              key={item.variantId}
              item={item}
              {...(writable
                ? {
                    onReceive: () => {
                      setSelectedVariant(item.variantId);
                      setDialog('RECEIPT');
                    },
                  }
                : {})}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<Boxes />}
            title="No stock-tracked products yet"
            detail="Add a product with stock tracking in Catalog. Its opening quantity will become the first audited inventory movement."
          />
        </div>
      )}
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <h2 className="font-display text-xl font-bold text-brand-navy">Recent stock trail</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Newest movements first. Nothing silently rewrites an old count.
          </p>
          <div className="mt-4 divide-y divide-border">
            {data.inventory.movements.slice(0, 8).map((movement) => (
              <div key={movement.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${movement.onHandDelta < 0 || movement.reservedDelta > 0 ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}`}
                >
                  <ArrowRightLeft className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-navy">
                    {movement.sku} · {movement.type.replaceAll('_', ' ')}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{movement.reason}</p>
                </div>
                <div className="text-right text-xs">
                  <strong className="block text-brand-navy">
                    {movement.onHandDelta > 0 ? '+' : ''}
                    {movement.onHandDelta} on hand
                  </strong>
                  <span className="text-ink-muted">
                    {movement.reservedDelta > 0 ? '+' : ''}
                    {movement.reservedDelta} reserved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="bg-brand-teal-soft/40">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-deep">
            How the number moves
          </p>
          <h2 className="mt-2 font-display text-xl font-bold text-brand-navy">
            Masaar handles normal stock automatically.
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink-muted">
            <FlowStep number="1" text="Customer confirmation reserves units." />
            <FlowStep number="2" text="Cancellation releases the reservation." />
            <FlowStep number="3" text="Delivery finalizes the sale and reduces on-hand." />
            <FlowStep number="4" text="A returned item changes stock only after inspection." />
          </div>
        </Card>
      </section>
      {dialog === 'RECEIPT' && (
        <ReceiptDialog
          data={data}
          role={role}
          selectedVariant={selectedVariant}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog === 'ADJUST' && (
        <AdjustmentDialog
          data={data}
          role={role}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function ReturnsControl({
  data,
  role,
  refresh,
}: {
  data: WorkspaceData;
  role: Role;
  refresh: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [workingCase, setWorkingCase] = useState<ReturnCase | null>(null);
  const writable = !['READ_ONLY', 'DRIVER'].includes(role);
  const active = data.inventory.returns.filter(
    (item) => item.status !== 'RESOLVED' && item.status !== 'CANCELLED',
  );
  return (
    <>
      <PageHeader
        eyebrow="Controlled after-sales"
        title="Returns & Exchanges"
        detail="Open one case from the original order, inspect what physically came back, decide whether it is sellable, and then handle the refund or replacement without losing the stock or money trail."
        actions={
          writable ? (
            <Button onClick={() => setCreateOpen(true)}>
              <RotateCcw className="size-4" /> Start return or exchange
            </Button>
          ) : undefined
        }
      />
      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Clock3}
          label="Open cases"
          value={`${data.inventory.returns.filter((item) => item.status === 'OPEN').length}`}
          detail="Waiting for physical receipt"
        />
        <Stat
          icon={PackageOpen}
          label="Received"
          value={`${data.inventory.returns.filter((item) => item.status === 'RECEIVED').length}`}
          detail="Needs owner/manager resolution"
          warning={data.inventory.returns.some((item) => item.status === 'RECEIVED')}
        />
        <Stat
          icon={CheckCircle2}
          label="Resolved"
          value={`${data.inventory.returns.filter((item) => item.status === 'RESOLVED').length}`}
          detail="Stock and money effects recorded"
        />
      </section>
      <Card className="mt-5 border-brand-teal/20 bg-gradient-to-r from-brand-teal-soft/70 to-white">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-deep">
              One case, three truths
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-brand-navy">
              Item condition → stock disposition → financial resolution
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Returning an order never automatically means the item is sellable or the customer was
              refunded.
            </p>
          </div>
          <ArrowRightLeft className="hidden size-10 text-brand-gold md:block" />
        </div>
      </Card>
      <div className="mt-6 space-y-4">
        {data.inventory.returns.length ? (
          data.inventory.returns.map((item) => (
            <Card
              key={item.id}
              className={item.status === 'RECEIVED' ? 'border-brand-gold/50' : ''}
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-brand-navy">
                      {item.orderNumber} · {item.type === 'EXCHANGE' ? 'Exchange' : 'Return'}
                    </h2>
                    <StatusBadge
                      tone={
                        item.status === 'RESOLVED'
                          ? 'success'
                          : item.status === 'RECEIVED'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {item.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {item.customerName} · {item.reason.replaceAll('_', ' ').toLowerCase()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.items.map((line) => (
                      <span
                        key={line.orderLineId}
                        className="rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold text-brand-navy"
                      >
                        {line.quantity}× {line.sku}
                        {line.disposition ? ` · ${line.disposition.replaceAll('_', ' ')}` : ''}
                      </span>
                    ))}
                  </div>
                  {item.replacementOrderId && (
                    <p className="mt-3 text-xs font-semibold text-brand-teal-deep">
                      Replacement order created and reserved: {item.replacementOrderId}
                    </p>
                  )}
                </div>
                {writable && item.status !== 'RESOLVED' && (
                  <Button
                    variant={item.status === 'RECEIVED' ? 'primary' : 'secondary'}
                    onClick={() => setWorkingCase(item)}
                  >
                    {item.status === 'OPEN' ? (
                      <>
                        <PackageOpen className="size-4" /> Receive & inspect
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" /> Resolve case
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<RotateCcw />}
            title="No return cases"
            detail="Start from a delivered or failed order. Masaar will prevent returning more units than the customer bought."
          />
        )}
      </div>
      {active.length > 0 && (
        <p className="mt-4 text-xs text-ink-muted">
          {active.length} case(s) remain operationally open. They stay visible until receipt and
          resolution are both recorded.
        </p>
      )}
      {createOpen && (
        <CreateReturnDialog
          data={data}
          role={role}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
      {workingCase?.status === 'OPEN' && (
        <ReceiveReturnDialog
          returnCase={workingCase}
          role={role}
          onClose={() => setWorkingCase(null)}
          onSaved={() => {
            setWorkingCase(null);
            refresh();
          }}
        />
      )}
      {workingCase?.status === 'RECEIVED' && (
        <ResolveReturnDialog
          returnCase={workingCase}
          role={role}
          onClose={() => setWorkingCase(null)}
          onSaved={() => {
            setWorkingCase(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function StockRow({ item, onReceive }: { item: InventoryStockItem; onReceive?: () => void }) {
  const tone =
    item.state === 'OUT'
      ? 'danger'
      : item.state === 'LOW'
        ? 'warning'
        : item.state === 'OVERSTOCKED'
          ? 'info'
          : 'success';
  return (
    <div className="grid gap-3 border-b border-border px-5 py-4 last:border-0 lg:grid-cols-[1.35fr_.72fr_.72fr_.72fr_.9fr_1.15fr_1fr] lg:items-center">
      <div>
        <div className="flex items-center gap-2">
          <strong className="text-brand-navy">{item.productName}</strong>
          <StatusBadge tone={tone}>{item.state}</StatusBadge>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-muted">
          {item.sku}
          {item.variantLabel ? ` · ${item.variantLabel}` : ''}
        </p>
      </div>
      <MiniNumber label="On hand" value={item.onHand} />
      <MiniNumber label="Reserved" value={item.reserved} />
      <MiniNumber
        label="Available"
        value={item.available}
        emphasis={item.available <= item.lowStockThreshold}
      />
      <div>
        <span className="text-[10px] font-bold uppercase text-ink-muted lg:hidden">
          Stock cover
        </span>
        <p className="text-sm font-semibold text-brand-navy">
          {item.stockCoverDays === null ? 'No sales yet' : `${item.stockCoverDays} days`}
        </p>
        <p className="text-[11px] text-ink-muted">{item.soldLast30Days} sold / 30d</p>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase text-ink-muted lg:hidden">Supplier</span>
        <p className="text-sm font-semibold text-brand-navy">{item.supplierName ?? 'Not linked'}</p>
        <p className="text-[11px] text-ink-muted">
          {item.supplierLeadTimeDays !== undefined
            ? `${item.supplierLeadTimeDays}d lead time`
            : 'Add supplier data'}
        </p>
      </div>
      <div>
        {item.suggestedRestockQuantity > 0 ? (
          <>
            <p className="text-sm font-bold text-warning-strong">
              Order {item.suggestedRestockQuantity}
            </p>
            <p className="text-[11px] text-ink-muted">
              ≈{' '}
              {formatMoney(
                item.suggestedRestockCost.amountMinor,
                item.suggestedRestockCost.currency,
              )}
            </p>
            {onReceive && (
              <button
                onClick={onReceive}
                className="mt-1 text-xs font-bold text-brand-teal-deep hover:underline"
              >
                Receive units
              </button>
            )}
          </>
        ) : (
          <span className="text-sm font-semibold text-success-strong">No action</span>
        )}
      </div>
    </div>
  );
}

function ReceiptDialog({
  data,
  role,
  selectedVariant,
  onClose,
  onSaved,
}: {
  data: WorkspaceData;
  role: Role;
  selectedVariant: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variantId, setVariantId] = useState(
    selectedVariant || data.inventory.items[0]?.variantId || '',
  );
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState('Supplier delivery');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const item = data.inventory.items.find((candidate) => candidate.variantId === variantId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await recordStockReceipt(role, {
        supplierId: item?.supplierId,
        reference,
        receivedAt: new Date().toISOString(),
        items: [{ variantId, quantity }],
      });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Receipt could not be saved.');
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Receive supplier stock"
      detail="Add only units that physically arrived. Masaar preserves the reference and receiving time."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Label text="Variant">
          <select
            className={field}
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {data.inventory.items.map((candidate) => (
              <option key={candidate.variantId} value={candidate.variantId}>
                {candidate.sku} · {candidate.productName}
              </option>
            ))}
          </select>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Quantity received">
            <input
              className={field}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Label>
          <Label text="Delivery note / invoice reference">
            <input
              className={field}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Label>
        </div>
        {item && (
          <p className="rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">
            Linked supplier:{' '}
            <strong className="text-brand-navy">{item.supplierName ?? 'None'}</strong>. Current
            available: {item.available}.
          </p>
        )}
        <FormError message={error} />
        <Button disabled={saving || !variantId}>{saving ? 'Saving…' : 'Record receipt'}</Button>
      </form>
    </Dialog>
  );
}

function AdjustmentDialog({
  data,
  role,
  onClose,
  onSaved,
}: {
  data: WorkspaceData;
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variantId, setVariantId] = useState(data.inventory.items[0]?.variantId ?? '');
  const current = data.inventory.items.find((item) => item.variantId === variantId);
  const [count, setCount] = useState(current?.onHand ?? 0);
  const [reason, setReason] = useState('Physical cycle count correction');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(
    () => setCount(data.inventory.items.find((item) => item.variantId === variantId)?.onHand ?? 0),
    [variantId, data.inventory.items],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adjustStock(role, { variantId, countedOnHand: count, reason });
      onSaved();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'Count could not be approved.');
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Approve a physical count"
      detail="Corrections need an owner/manager reason because they can hide loss, damage or receiving mistakes."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Label text="Variant">
          <select
            className={field}
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {data.inventory.items.map((item) => (
              <option key={item.variantId} value={item.variantId}>
                {item.sku} · system says {item.onHand}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Units physically counted">
          <input
            className={field}
            type="number"
            min="0"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </Label>
        <Label text="Reason">
          <textarea
            className={`${field} min-h-24 py-3`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Label>
        <FormError message={error} />
        <Button disabled={saving}>{saving ? 'Approving…' : 'Approve correction'}</Button>
      </form>
    </Dialog>
  );
}

function CreateReturnDialog({
  data,
  role,
  onClose,
  onSaved,
}: {
  data: WorkspaceData;
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const eligible = data.orders.filter((order) =>
    ['DELIVERED', 'FAILED', 'RETURNED'].includes(order.status),
  );
  const [orderId, setOrderId] = useState(eligible[0]?.id ?? '');
  const order = eligible.find((candidate) => candidate.id === orderId);
  const [lineId, setLineId] = useState(order?.items[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<'RETURN' | 'EXCHANGE'>('RETURN');
  const [reason, setReason] = useState<
    | 'WRONG_SIZE_OR_VARIANT'
    | 'DAMAGED_ITEM'
    | 'NOT_AS_EXPECTED'
    | 'CUSTOMER_CHANGED_MIND'
    | 'DELIVERY_FAILURE'
    | 'OTHER'
  >('WRONG_SIZE_OR_VARIANT');
  const [replacement, setReplacement] = useState(data.inventory.items[0]?.variantId ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(
    () => setLineId(eligible.find((candidate) => candidate.id === orderId)?.items[0]?.id ?? ''),
    [orderId],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createReturnCase(role, {
        orderId,
        type,
        reason,
        note,
        items: [
          {
            orderLineId: lineId,
            quantity,
            ...(type === 'EXCHANGE' ? { replacementVariantId: replacement } : {}),
          },
        ],
      });
      onSaved();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'Case could not be created.');
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Start from the original order"
      detail="This prevents duplicate refunds and returning more units than the customer bought."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {eligible.length ? (
          <>
            <Label text="Original order">
              <select
                className={field}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                {eligible.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.orderNumber} · {item.customerName} · {item.status}
                  </option>
                ))}
              </select>
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label text="Type">
                <select
                  className={field}
                  value={type}
                  onChange={(e) => setType(e.target.value as 'RETURN' | 'EXCHANGE')}
                >
                  <option value="RETURN">Return</option>
                  <option value="EXCHANGE">Exchange</option>
                </select>
              </Label>
              <Label text="Reason">
                <select
                  className={field}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as typeof reason)}
                >
                  <option value="WRONG_SIZE_OR_VARIANT">Wrong size or variant</option>
                  <option value="DAMAGED_ITEM">Damaged item</option>
                  <option value="NOT_AS_EXPECTED">Not as expected</option>
                  <option value="CUSTOMER_CHANGED_MIND">Customer changed mind</option>
                  <option value="DELIVERY_FAILURE">Delivery failure</option>
                  <option value="OTHER">Other</option>
                </select>
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Label text="Returned item">
                <select
                  className={field}
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                >
                  {order?.items.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.sku} · bought {line.quantity}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text="Quantity">
                <input
                  className={field}
                  type="number"
                  min="1"
                  max={order?.items.find((line) => line.id === lineId)?.quantity ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Label>
            </div>
            {type === 'EXCHANGE' && (
              <Label text="Replacement variant">
                <select
                  className={field}
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  {data.inventory.items
                    .filter((item) => item.available > 0)
                    .map((item) => (
                      <option key={item.variantId} value={item.variantId}>
                        {item.sku} · {item.available} available
                      </option>
                    ))}
                </select>
              </Label>
            )}
            <Label text="Internal note">
              <textarea
                className={`${field} min-h-20 py-3`}
                placeholder="What did the customer report?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Label>
            <FormError message={error} />
            <Button disabled={saving || !orderId || !lineId}>
              {saving ? 'Opening…' : 'Open case'}
            </Button>
          </>
        ) : (
          <EmptyState
            icon={<PackageOpen />}
            title="No eligible orders"
            detail="A return starts only from a delivered or failed order."
          />
        )}
      </form>
    </Dialog>
  );
}

function ReceiveReturnDialog({
  returnCase,
  role,
  onClose,
  onSaved,
}: {
  returnCase: ReturnCase;
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [condition, setCondition] = useState<'SEALED' | 'SELLABLE' | 'OPENED' | 'DAMAGED'>(
    'SELLABLE',
  );
  const [disposition, setDisposition] = useState<
    'RESTOCK' | 'QUARANTINE' | 'DAMAGED_WRITE_OFF' | 'RETURN_TO_SUPPLIER'
  >('RESTOCK');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await receiveReturnCase(role, returnCase.id, {
        items: returnCase.items.map((item) => ({
          orderLineId: item.orderLineId,
          condition,
          disposition,
        })),
        note,
      });
      onSaved();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Receipt could not be saved.');
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Receive and inspect the item"
      detail="Choose whether the physical item is safe to sell. A return is never automatically restocked."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-surface-muted p-3 text-sm font-semibold text-brand-navy">
          {returnCase.items.map((item) => `${item.quantity}× ${item.sku}`).join(', ')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Condition">
            <select
              className={field}
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
            >
              <option value="SEALED">Sealed</option>
              <option value="SELLABLE">Opened but sellable</option>
              <option value="OPENED">Opened / inspect further</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </Label>
          <Label text="Stock decision">
            <select
              className={field}
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as typeof disposition)}
            >
              <option value="RESTOCK">Return to sellable stock</option>
              <option value="QUARANTINE">Keep outside sellable stock</option>
              <option value="DAMAGED_WRITE_OFF">Damaged write-off</option>
              <option value="RETURN_TO_SUPPLIER">Return to supplier</option>
            </select>
          </Label>
        </div>
        <Label text="Inspection note">
          <textarea
            className={`${field} min-h-20 py-3`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Label>
        <FormError message={error} />
        <Button disabled={saving}>{saving ? 'Recording…' : 'Confirm physical receipt'}</Button>
      </form>
    </Dialog>
  );
}

function ResolveReturnDialog({
  returnCase,
  role,
  onClose,
  onSaved,
}: {
  returnCase: ReturnCase;
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const maximum = returnCase.items.reduce(
    (sum, item) => sum + item.unitPrice.amountMinor * item.quantity,
    0,
  );
  const currency = returnCase.items[0]?.unitPrice.currency ?? 'USD';
  const [refund, setRefund] = useState(returnCase.type === 'RETURN' ? maximum : 0);
  const [method, setMethod] = useState<'CASH' | 'WHISH' | 'OMT' | 'CARD' | 'BANK' | 'OTHER'>(
    'CASH',
  );
  const [reference, setReference] = useState('Return approved');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allowed = role === 'OWNER' || role === 'MANAGER';
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await resolveReturnCase(role, returnCase.id, {
        refundAmountMinor: refund,
        ...(refund > 0 ? { refundMethod: method } : {}),
        refundReference: reference,
      });
      onSaved();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Case could not be resolved.');
      setSaving(false);
    }
  }
  return (
    <Dialog
      title={
        returnCase.type === 'EXCHANGE' ? 'Create the controlled replacement' : 'Finalize the return'
      }
      detail={
        returnCase.type === 'EXCHANGE'
          ? 'Masaar creates a linked confirmed replacement order, reserves its stock, and sends it through normal preparation and delivery.'
          : 'Record only the money actually returned. Payment status remains separate from item receipt.'
      }
      onClose={onClose}
    >
      {allowed ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-brand-teal-soft p-3 text-sm text-brand-teal-deep">
            Maximum returned item value: <strong>{formatMoney(maximum, currency)}</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text="Refund amount">
              <input
                className={field}
                type="number"
                min="0"
                max={maximum}
                value={refund}
                onChange={(e) => setRefund(Number(e.target.value))}
              />
            </Label>
            <Label text="Refund method">
              <select
                className={field}
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                disabled={refund === 0}
              >
                <option value="CASH">Cash</option>
                <option value="WHISH">Whish</option>
                <option value="OMT">OMT</option>
                <option value="CARD">Card</option>
                <option value="BANK">Bank</option>
                <option value="OTHER">Other</option>
              </select>
            </Label>
          </div>
          <Label text="Reference / explanation">
            <input
              className={field}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Label>
          <FormError message={error} />
          <Button disabled={saving}>
            {saving
              ? 'Resolving…'
              : returnCase.type === 'EXCHANGE'
                ? 'Create replacement & resolve'
                : 'Record refund & resolve'}
          </Button>
        </form>
      ) : (
        <EmptyState
          icon={<ShieldCheck />}
          title="Manager approval required"
          detail="The item has been received. An owner or manager must approve the financial resolution or replacement."
        />
      )}
    </Dialog>
  );
}

function PageHeader({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-command-header flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{detail}</p>
      </div>
      {actions}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
  priority = false,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
  priority?: boolean;
}) {
  return (
    <Card
      className={`metric-depth transition hover:-translate-y-0.5 hover:shadow-lg ${priority ? 'border-brand-gold/45 bg-gradient-to-br from-brand-gold-soft/80 via-white to-white' : ''}`}
    >
      <div
        className={`grid size-10 place-items-center rounded-xl ${priority ? 'bg-brand-gold text-brand-navy shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_5px_12px_rgba(217,173,88,.25)]' : warning ? 'bg-warning-soft text-warning-strong' : 'bg-brand-teal-soft text-brand-teal-deep'}`}
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-brand-navy">{value}</p>
      <p className="mt-1 text-[11px] text-ink-muted">{detail}</p>
    </Card>
  );
}
function MiniNumber({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase text-ink-muted lg:hidden">{label}</span>
      <p
        className={`font-display text-lg font-bold ${emphasis ? 'text-warning-strong' : 'text-brand-navy'}`}
      >
        {value}
      </p>
    </div>
  );
}
function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-navy text-xs font-bold text-brand-teal">
        {number}
      </span>
      <p>{text}</p>
    </div>
  );
}
function Dialog({
  title,
  detail,
  onClose,
  children,
}: {
  title: string;
  detail: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-navy">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{detail}</p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-xl p-2 text-ink-muted hover:bg-surface-muted"
          >
            <X />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-brand-navy">{text}</span>
      {children}
    </label>
  );
}
function FormError({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-strong"
    >
      {message}
    </p>
  ) : null;
}
function InventoryLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="mt-6 h-96" />
    </div>
  );
}
