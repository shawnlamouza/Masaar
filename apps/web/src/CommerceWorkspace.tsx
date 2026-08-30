import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CreateCustomer,
  CreateProduct,
  CreateSupplier,
  Customer,
  Money,
  PriceReview,
  Product,
  Role,
  Supplier,
  UpdateProduct,
} from '@masaar/contracts';
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  MapPin,
  PackagePlus,
  Phone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Warehouse,
  X,
} from 'lucide-react';
import {
  approvePriceReview,
  createCustomer,
  createFxSnapshot,
  createPriceReview,
  createProduct,
  createSupplier,
  getCommerceSnapshot,
  reviewDuplicateCustomer,
  updateCustomer,
  updateProduct,
  updateSupplier,
  type CommerceSnapshot,
} from './api';

export type CommerceView = 'Catalog' | 'Customers' | 'Suppliers' | 'Price Studio';

const canWriteCustomers = (role: Role) => !['DRIVER', 'READ_ONLY'].includes(role);
const canManageCatalog = (role: Role) => role === 'OWNER' || role === 'MANAGER';
const canManagePricing = (role: Role) => role === 'OWNER' || role === 'MANAGER';

export function CommerceWorkspace({ view, role }: { view: CommerceView; role: Role }) {
  const [data, setData] = useState<CommerceSnapshot | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    getCommerceSnapshot(role)
      .then((next) => active && setData(next))
      .catch(
        (reason: unknown) =>
          active &&
          setError(reason instanceof Error ? reason.message : 'Commerce data could not be loaded.'),
      );
    return () => {
      active = false;
    };
  }, [role, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);

  if (error) return <CommerceError message={error} retry={refresh} />;
  if (!data) return <CommerceLoading view={view} />;

  return (
    <div className="mx-auto max-w-7xl">
      {view === 'Catalog' && <CatalogView data={data} role={role} refresh={refresh} />}
      {view === 'Customers' && <CustomersView data={data} role={role} refresh={refresh} />}
      {view === 'Suppliers' && <SuppliersView data={data} role={role} refresh={refresh} />}
      {view === 'Price Studio' && <PriceStudio data={data} role={role} refresh={refresh} />}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function CatalogView({ data, role, refresh }: ViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const latestFx = data.fxSnapshots[0];
  return (
    <>
      <PageHeading
        eyebrow="Structured selling data"
        title="Product catalog"
        detail="Every variant has one SKU, explicit selling currency, cost history, supplier and optional stock—so later orders and intelligence use facts rather than chat text."
        action={
          canManageCatalog(role) ? (
            <Button onClick={() => setShowForm(true)}>
              <PackagePlus className="size-4" />
              Add product
            </Button>
          ) : undefined
        }
      />
      <section aria-label="Catalog summary" className="mt-7 grid gap-3 sm:grid-cols-3">
        <MiniStat icon={Boxes} label="Active products" value={`${data.summary.activeProducts}`} />
        <MiniStat
          icon={Warehouse}
          label="Tracked variants"
          value={`${data.summary.activeVariants}`}
        />
        <MiniStat
          icon={ShieldAlert}
          label="Low-stock variants"
          value={`${data.summary.lowStockVariants}`}
          warning={data.summary.lowStockVariants > 0}
        />
      </section>
      <div className="mt-7 space-y-4">
        {data.products.map((product) => (
          <Card key={product.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-brand-navy">{product.name}</h2>
                  <StatusBadge tone={product.active ? 'success' : 'warning'}>
                    {product.active ? 'Available' : 'Paused'}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {product.category} · {product.variants.length} variant
                  {product.variants.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-muted">
                  {product.trackStock ? 'Stock tracked' : 'Stock optional'}
                </span>
                {canManageCatalog(role) && (
                  <Button
                    variant="secondary"
                    aria-label={`Edit product ${product.name}`}
                    onClick={() => setEditingProduct(product)}
                  >
                    <Pencil className="size-4" /> Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-3 md:hidden">
              {product.variants.map((variant) => {
                const supplier = data.suppliers.find((item) => item.id === variant.supplierId);
                const margin = latestFx
                  ? calculateMargin(
                      variant.currentSellingPrice,
                      variant.currentUnitCost,
                      latestFx.lbpPerUsd,
                    )
                  : null;
                return (
                  <div key={variant.id} className="rounded-xl bg-surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="text-brand-navy">
                          {[variant.size, variant.color].filter(Boolean).join(' · ') || 'Default'}
                        </strong>
                        <div className="mt-1 font-mono text-xs text-ink-muted">{variant.sku}</div>
                      </div>
                      <span
                        className={
                          variant.stockOnHand !== undefined && variant.stockOnHand <= 3
                            ? 'font-bold text-warning-strong'
                            : 'font-semibold text-brand-navy'
                        }
                      >
                        {variant.stockOnHand ?? '—'} in stock
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-ink-muted">{supplier?.name ?? 'Unassigned'}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
                      <ImpactValue
                        label="Selling"
                        value={formatMoney(variant.currentSellingPrice)}
                      />
                      <ImpactValue label="Cost" value={formatMoney(variant.currentUnitCost)} />
                      <ImpactValue
                        label="Margin"
                        value={margin === null ? '—' : `${margin.toFixed(1)}%`}
                        strong={margin !== null && margin >= 25}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="pb-3">Variant / SKU</th>
                    <th className="pb-3">Supplier</th>
                    <th className="pb-3">Selling price</th>
                    <th className="pb-3">Unit cost</th>
                    <th className="pb-3">Gross margin</th>
                    <th className="pb-3 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => {
                    const supplier = data.suppliers.find((item) => item.id === variant.supplierId);
                    const margin = latestFx
                      ? calculateMargin(
                          variant.currentSellingPrice,
                          variant.currentUnitCost,
                          latestFx.lbpPerUsd,
                        )
                      : null;
                    return (
                      <tr key={variant.id} className="border-b border-border/70 last:border-0">
                        <td className="py-4">
                          <strong className="text-brand-navy">
                            {[variant.size, variant.color].filter(Boolean).join(' · ') || 'Default'}
                          </strong>
                          <div className="mt-1 font-mono text-xs text-ink-muted">{variant.sku}</div>
                        </td>
                        <td className="py-4 text-ink-muted">{supplier?.name ?? 'Unassigned'}</td>
                        <td className="py-4 font-semibold">
                          {formatMoney(variant.currentSellingPrice)}
                        </td>
                        <td className="py-4">
                          {formatMoney(variant.currentUnitCost)}
                          <div className="mt-1 text-[11px] text-ink-muted">
                            {variant.costHistory.length} snapshot
                            {variant.costHistory.length === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td className="py-4">
                          {margin === null ? (
                            '—'
                          ) : (
                            <span
                              className={
                                margin < 25
                                  ? 'font-bold text-danger-strong'
                                  : 'font-bold text-success-strong'
                              }
                            >
                              {margin.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <span
                            className={
                              variant.stockOnHand !== undefined && variant.stockOnHand <= 3
                                ? 'font-bold text-warning-strong'
                                : 'font-semibold'
                            }
                          >
                            {variant.stockOnHand ?? 'Not tracked'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
      {showForm && (
        <ProductForm
          data={data}
          role={role}
          close={() => setShowForm(false)}
          saved={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
      {editingProduct && (
        <ProductEditor
          product={editingProduct}
          data={data}
          role={role}
          close={() => setEditingProduct(null)}
          saved={() => {
            setEditingProduct(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function ProductForm({ data, role, close, saved }: FormProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const input: CreateProduct = {
      name: String(values.get('name')),
      category: String(values.get('category')),
      active: true,
      trackStock: true,
      variants: [
        {
          sku: String(values.get('sku')).toUpperCase(),
          size: String(values.get('size')) || undefined,
          color: String(values.get('color')) || undefined,
          available: true,
          stockOnHand: Number(values.get('stock')),
          currentSellingPrice: {
            amountMinor: Math.round(Number(values.get('price')) * 100),
            currency: 'USD',
          },
          currentUnitCost: {
            amountMinor: Math.round(Number(values.get('cost')) * 100),
            currency: 'USD',
          },
          supplierId: String(values.get('supplierId')) || undefined,
        },
      ],
    };
    try {
      await createProduct(role, input);
      saved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Product could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      title="Add one structured product"
      detail="Start with one valid variant; more sizes and colors can be added through the catalog model."
      close={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Product name" name="name" placeholder="Linen trousers" required />
        <Field label="Category" name="category" placeholder="Apparel" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" name="sku" placeholder="LIN-TROU-S" required />
          <Field
            label="Opening stock"
            name="stock"
            type="number"
            defaultValue="10"
            min="0"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Size" name="size" placeholder="S" />
          <Field label="Color" name="color" placeholder="Sand" />
        </div>
        <label className="block text-sm font-semibold">
          Supplier
          <select name="supplierId" className={controlClass}>
            <option value="">Unassigned</option>
            {data.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Selling price (USD)"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue="35.00"
            required
          />
          <Field
            label="Unit cost (USD)"
            name="cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue="18.00"
            required
          />
        </div>
        <FormError message={error} />
        <Button disabled={saving} className="w-full">
          <Save className="size-4" />
          {saving ? 'Saving…' : 'Save product'}
        </Button>
      </form>
    </Drawer>
  );
}

type EditableVariant = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  available: boolean;
  stock: string;
  sellingAmount: string;
  sellingCurrency: 'USD' | 'LBP';
  costAmount: string;
  costCurrency: 'USD' | 'LBP';
  supplierId: string;
};

function ProductEditor({ product, data, role, close, saved }: FormProps & { product: Product }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [active, setActive] = useState(product.active);
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState<EditableVariant[]>(
    product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size ?? '',
      color: variant.color ?? '',
      available: variant.available,
      stock: String(variant.stockOnHand ?? 0),
      sellingAmount:
        variant.currentSellingPrice.currency === 'USD'
          ? (variant.currentSellingPrice.amountMinor / 100).toFixed(2)
          : String(variant.currentSellingPrice.amountMinor),
      sellingCurrency: variant.currentSellingPrice.currency,
      costAmount:
        variant.currentUnitCost.currency === 'USD'
          ? (variant.currentUnitCost.amountMinor / 100).toFixed(2)
          : String(variant.currentUnitCost.amountMinor),
      costCurrency: variant.currentUnitCost.currency,
      supplierId: variant.supplierId ?? '',
    })),
  );
  const changeVariant = (index: number, change: Partial<EditableVariant>) =>
    setVariants((current) =>
      current.map((variant, candidate) =>
        candidate === index ? { ...variant, ...change } : variant,
      ),
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const input: UpdateProduct = {
      name,
      category,
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      active,
      trackStock,
      variants: variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        sku: variant.sku.trim().toUpperCase(),
        ...(variant.size.trim() ? { size: variant.size.trim() } : {}),
        ...(variant.color.trim() ? { color: variant.color.trim() } : {}),
        available: variant.available,
        ...(trackStock ? { stockOnHand: Math.max(0, Math.round(Number(variant.stock) || 0)) } : {}),
        currentSellingPrice: {
          amountMinor:
            variant.sellingCurrency === 'USD'
              ? Math.round(Number(variant.sellingAmount) * 100)
              : Math.round(Number(variant.sellingAmount)),
          currency: variant.sellingCurrency,
        },
        currentUnitCost: {
          amountMinor:
            variant.costCurrency === 'USD'
              ? Math.round(Number(variant.costAmount) * 100)
              : Math.round(Number(variant.costAmount)),
          currency: variant.costCurrency,
        },
        ...(variant.supplierId ? { supplierId: variant.supplierId } : {}),
      })),
    };
    try {
      await updateProduct(role, product.id, input);
      saved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Product changes could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      title="Edit product and variants"
      detail="Changes save immediately. Existing variants remain traceable; pause them instead of deleting records referenced by orders. Use Inventory for stock corrections."
      close={close}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field
          label="Product name"
          name="edit-product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Field
          label="Category"
          name="edit-product-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Product available
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(event) => setTrackStock(event.target.checked)}
            />
            Track inventory
          </label>
        </div>
        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.id ?? `new-${index}`}
              className="rounded-2xl border border-border bg-surface-muted p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-brand-navy">
                  {variant.id ? `Variant ${index + 1}` : 'New variant'}
                </strong>
                <label className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                  <input
                    type="checkbox"
                    checked={variant.available}
                    onChange={(event) => changeVariant(index, { available: event.target.checked })}
                  />
                  Available
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field
                  label="SKU"
                  name={`sku-${index}`}
                  value={variant.sku}
                  onChange={(event) => changeVariant(index, { sku: event.target.value })}
                  required
                />
                <label className="text-sm font-semibold">
                  Supplier
                  <select
                    className={controlClass}
                    value={variant.supplierId}
                    onChange={(event) => changeVariant(index, { supplierId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {data.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Size"
                  name={`size-${index}`}
                  value={variant.size}
                  onChange={(event) => changeVariant(index, { size: event.target.value })}
                />
                <Field
                  label="Color"
                  name={`color-${index}`}
                  value={variant.color}
                  onChange={(event) => changeVariant(index, { color: event.target.value })}
                />
                <MoneyEditor
                  label="Selling price"
                  amount={variant.sellingAmount}
                  currency={variant.sellingCurrency}
                  onAmount={(sellingAmount) => changeVariant(index, { sellingAmount })}
                  onCurrency={(sellingCurrency) => changeVariant(index, { sellingCurrency })}
                />
                <MoneyEditor
                  label="Unit cost"
                  amount={variant.costAmount}
                  currency={variant.costCurrency}
                  onAmount={(costAmount) => changeVariant(index, { costAmount })}
                  onCurrency={(costCurrency) => changeVariant(index, { costCurrency })}
                />
                <Field
                  label={variant.id ? 'Stock (change in Inventory)' : 'Opening stock'}
                  name={`stock-${index}`}
                  type="number"
                  min="0"
                  value={variant.stock}
                  disabled={Boolean(variant.id)}
                  onChange={(event) => changeVariant(index, { stock: event.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() =>
            setVariants((current) => [
              ...current,
              {
                sku: '',
                size: '',
                color: '',
                available: true,
                stock: '0',
                sellingAmount: '0.00',
                sellingCurrency: 'USD',
                costAmount: '0.00',
                costCurrency: 'USD',
                supplierId: '',
              },
            ])
          }
        >
          <Plus className="size-4" /> Add another variant
        </Button>
        <FormError message={error} />
        <Button disabled={saving} className="w-full">
          <Save className="size-4" /> {saving ? 'Saving…' : 'Save product changes'}
        </Button>
      </form>
    </Drawer>
  );
}

function MoneyEditor({
  label,
  amount,
  currency,
  onAmount,
  onCurrency,
}: {
  label: string;
  amount: string;
  currency: 'USD' | 'LBP';
  onAmount: (value: string) => void;
  onCurrency: (value: 'USD' | 'LBP') => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <div className="mt-2 flex">
        <input
          className="min-h-11 min-w-0 flex-1 rounded-l-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand-teal"
          type="number"
          min="0"
          step={currency === 'USD' ? '0.01' : '1'}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          required
        />
        <select
          aria-label={`${label} currency`}
          className="min-h-11 rounded-r-xl border border-l-0 border-border bg-white px-2 text-sm font-bold"
          value={currency}
          onChange={(event) => onCurrency(event.target.value as 'USD' | 'LBP')}
        >
          <option>USD</option>
          <option>LBP</option>
        </select>
      </div>
    </label>
  );
}

function CustomersView({ data, role, refresh }: ViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [phone, setPhone] = useState('');
  const [review, setReview] = useState('');
  async function checkPhone() {
    try {
      const result = await reviewDuplicateCustomer(role, phone);
      setReview(
        result.exactMatch
          ? `Already exists: ${result.matches[0]?.name}`
          : result.matches.length
            ? `Possible match: ${result.matches[0]?.name}`
            : `No match. Masaar will save ${result.normalizedPhone}.`,
      );
    } catch (reason) {
      setReview(reason instanceof Error ? reason.message : 'Could not check this number.');
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="One customer, one history"
        title="Customer profiles"
        detail="Lebanese phone normalization and structured addresses prevent duplicate chats, lost landmarks and repeated delivery mistakes."
        action={
          canWriteCustomers(role) ? (
            <Button onClick={() => setShowForm(true)}>
              <UserPlus className="size-4" />
              Add customer
            </Button>
          ) : undefined
        }
      />
      <Card className="mt-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold">
            Duplicate check before creating
            <input
              aria-label="Customer phone to check"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="70 123 456 or +961…"
              className={controlClass}
            />
          </label>
          <Button variant="secondary" onClick={checkPhone}>
            <Phone className="size-4" />
            Check phone
          </Button>
        </div>
        {review && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-brand-teal-soft px-4 py-3 text-sm font-semibold text-brand-teal-deep"
          >
            {review}
          </p>
        )}
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.customers.map((customer) => (
          <Card key={customer.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-navy">{customer.name}</h2>
                <p className="mt-1 font-mono text-sm text-brand-teal-deep">
                  {customer.phoneNormalized}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone="info">{customer.preferredPaymentMethod}</StatusBadge>
                {canWriteCustomers(role) && (
                  <Button
                    variant="secondary"
                    aria-label={`Edit customer ${customer.name}`}
                    onClick={() => setEditingCustomer(customer)}
                  >
                    <Pencil className="size-4" /> Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-surface-muted p-4 text-center">
              <CustomerStat label="Completed" value={customer.orderStats.completedOrders} />
              <CustomerStat label="Failed" value={customer.orderStats.failedDeliveries} />
              <CustomerStat
                label="Spend"
                value={`$${(customer.orderStats.lifetimeSpendUsdMinor / 100).toFixed(0)}`}
              />
            </div>
            {customer.addresses[0] && (
              <div className="mt-4 flex gap-3 text-sm">
                <MapPin className="mt-0.5 size-5 shrink-0 text-brand-gold" />
                <div>
                  <strong className="text-brand-navy">
                    {customer.addresses[0].label}: {customer.addresses[0].locality}
                  </strong>
                  <p className="mt-1 leading-5 text-ink-muted">
                    {customer.addresses[0].building}
                    {customer.addresses[0].floor
                      ? `, floor ${customer.addresses[0].floor}`
                      : ''} · {customer.addresses[0].landmark}
                  </p>
                  <p className="mt-1 text-xs italic text-ink-muted">
                    Original: “{customer.addresses[0].originalWording}”
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-gold-soft px-2.5 py-1 text-xs font-semibold text-warning-strong"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {showForm && (
        <CustomerForm
          role={role}
          close={() => setShowForm(false)}
          saved={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
      {editingCustomer && (
        <CustomerForm
          role={role}
          customer={editingCustomer}
          close={() => setEditingCustomer(null)}
          saved={() => {
            setEditingCustomer(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function CustomerForm({
  role,
  close,
  saved,
  customer,
}: Omit<FormProps, 'data'> & { customer?: Customer }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const v = new FormData(event.currentTarget);
    const input: CreateCustomer = {
      name: String(v.get('name')),
      phoneOriginal: String(v.get('phone')),
      preferredPaymentMethod: String(v.get('payment')) as CreateCustomer['preferredPaymentMethod'],
      tags: customer?.tags ?? ['manual entry'],
      notes: String(v.get('notes')),
      addresses: [
        {
          label: 'Primary',
          governorate: String(
            v.get('governorate'),
          ) as CreateCustomer['addresses'][number]['governorate'],
          area: String(v.get('area')),
          locality: String(v.get('locality')),
          street: String(v.get('street')),
          building: String(v.get('building')),
          floor: String(v.get('floor')),
          landmark: String(v.get('landmark')),
          originalWording: String(v.get('originalWording')),
        },
      ],
    };
    try {
      if (customer) await updateCustomer(role, customer.id, input);
      else await createCustomer(role, input);
      saved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Customer could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      title={customer ? 'Edit customer profile' : 'Add a customer'}
      detail="Masaar preserves both a standardized Lebanese address and the customer’s original wording."
      close={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Customer name" name="name" defaultValue={customer?.name} required />
        <Field
          label="Lebanese phone"
          name="phone"
          placeholder="70 123 456"
          defaultValue={customer?.phoneOriginal}
          required
        />
        <label className="block text-sm font-semibold">
          Preferred payment
          <select
            name="payment"
            className={controlClass}
            defaultValue={customer?.preferredPaymentMethod}
          >
            {['CASH', 'WHISH', 'OMT', 'CARD', 'BANK', 'OTHER'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-gold">
            Structured delivery address
          </p>
          <label className="block text-sm font-semibold">
            Governorate
            <select
              name="governorate"
              className={controlClass}
              defaultValue={customer?.addresses[0]?.governorate}
            >
              {[
                'Beirut',
                'Mount Lebanon',
                'North Lebanon',
                'Akkar',
                'Bekaa',
                'Baalbek-Hermel',
                'South Lebanon',
                'Nabatieh',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Area / district"
              name="area"
              placeholder="Achrafieh"
              defaultValue={customer?.addresses[0]?.area}
              required
            />
            <Field
              label="Locality"
              name="locality"
              placeholder="Sassine"
              defaultValue={customer?.addresses[0]?.locality}
              required
            />
          </div>
          <Field label="Street" name="street" defaultValue={customer?.addresses[0]?.street} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Building"
              name="building"
              defaultValue={customer?.addresses[0]?.building}
            />
            <Field label="Floor" name="floor" defaultValue={customer?.addresses[0]?.floor} />
          </div>
          <Field
            label="Landmark"
            name="landmark"
            placeholder="Behind ABC Mall"
            defaultValue={customer?.addresses[0]?.landmark}
          />
          <Field
            label="Original customer wording"
            name="originalWording"
            placeholder="Achrafieh behind ABC, Cedar bldg 4th floor"
            defaultValue={customer?.addresses[0]?.originalWording}
            required
          />
        </div>
        <Field label="Internal note" name="notes" defaultValue={customer?.notes} />
        <FormError message={error} />
        <Button disabled={saving} className="w-full">
          <Save className="size-4" />
          {saving ? 'Saving…' : customer ? 'Save profile changes' : 'Save customer'}
        </Button>
      </form>
    </Drawer>
  );
}

function SuppliersView({ data, role, refresh }: ViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="Lightweight supply inputs"
        title="Suppliers"
        detail="Lead time, minimum quantity and last confirmed cost provide the practical inputs Masaar will later use for stock warnings and restocking recommendations."
        action={
          canManagePricing(role) ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="size-4" />
              Add supplier
            </Button>
          ) : undefined
        }
      />
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {data.suppliers.map((supplier) => {
          const variantCount = data.products
            .flatMap((product) => product.variants)
            .filter((variant) => variant.supplierId === supplier.id).length;
          return (
            <Card key={supplier.id}>
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand-teal-soft text-brand-teal-deep">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-brand-navy">
                      {supplier.name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {supplier.contactName || 'No contact recorded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={supplier.active ? 'success' : 'warning'}>
                    {supplier.active ? 'Active' : 'Paused'}
                  </StatusBadge>
                  {canManagePricing(role) && (
                    <Button
                      variant="secondary"
                      aria-label={`Edit supplier ${supplier.name}`}
                      onClick={() => setEditingSupplier(supplier)}
                    >
                      <Pencil className="size-4" /> Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <SupplierStat
                  icon={Clock3}
                  label="Lead time"
                  value={`${supplier.leadTimeDays} days`}
                />
                <SupplierStat
                  icon={Boxes}
                  label="Minimum"
                  value={`${supplier.minimumOrderQuantity} units`}
                />
                <SupplierStat
                  icon={CircleDollarSign}
                  label="Last cost"
                  value={supplier.lastPurchaseCost ? formatMoney(supplier.lastPurchaseCost) : '—'}
                />
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-ink-muted">
                  {variantCount} linked catalog variant{variantCount === 1 ? '' : 's'}
                </span>
                <span className="font-mono text-xs text-brand-teal-deep">
                  {supplier.phone ?? 'No phone'}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      {showForm && (
        <SupplierForm
          role={role}
          close={() => setShowForm(false)}
          saved={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
      {editingSupplier && (
        <SupplierForm
          role={role}
          supplier={editingSupplier}
          close={() => setEditingSupplier(null)}
          saved={() => {
            setEditingSupplier(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function SupplierForm({
  role,
  close,
  saved,
  supplier,
}: Omit<FormProps, 'data'> & { supplier?: Supplier }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const v = new FormData(event.currentTarget);
    const input: CreateSupplier = {
      name: String(v.get('name')),
      contactName: String(v.get('contact')),
      phone: String(v.get('phone')) || undefined,
      leadTimeDays: Number(v.get('lead')),
      minimumOrderQuantity: Number(v.get('minimum')),
      active: supplier?.active ?? true,
    };
    try {
      if (supplier) await updateSupplier(role, supplier.id, input);
      else await createSupplier(role, input);
      saved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Supplier could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      title={supplier ? 'Edit supplier' : 'Add a supplier'}
      detail="Keep this lightweight: enough information for cost, availability and future restocking decisions."
      close={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Supplier name" name="name" defaultValue={supplier?.name} required />
        <Field label="Contact name" name="contact" defaultValue={supplier?.contactName} />
        <Field
          label="Lebanese phone"
          name="phone"
          placeholder="70 111 444"
          defaultValue={supplier?.phone}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Lead time (days)"
            name="lead"
            type="number"
            min="0"
            defaultValue={supplier?.leadTimeDays ?? 5}
            required
          />
          <Field
            label="Minimum quantity"
            name="minimum"
            type="number"
            min="1"
            defaultValue={supplier?.minimumOrderQuantity ?? 10}
            required
          />
        </div>
        <FormError message={error} />
        <Button className="w-full" disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving…' : supplier ? 'Save supplier changes' : 'Save supplier'}
        </Button>
      </form>
    </Drawer>
  );
}

function PriceStudio({ data, role, refresh }: ViewProps) {
  const latestFx = data.fxSnapshots[0];
  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id ?? '');
  const [cost, setCost] = useState('23.00');
  const [target, setTarget] = useState('40');
  const [rate, setRate] = useState(String(latestFx?.lbpPerUsd ?? 89500));
  const [review, setReview] = useState<PriceReview | null>(data.priceReviews[0] ?? null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const affectedCount = useMemo(
    () =>
      data.products
        .flatMap((product) => product.variants)
        .filter((variant) => variant.supplierId === supplierId).length,
    [data.products, supplierId],
  );
  async function recordFx() {
    if (!canManagePricing(role)) return;
    setBusy(true);
    setMessage('');
    try {
      await createFxSnapshot(role, {
        lbpPerUsd: Number(rate),
        effectiveAt: new Date().toISOString(),
        note: 'Owner-entered operating reference',
      });
      setMessage('New FX reference recorded without rewriting earlier snapshots.');
      refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'FX reference could not be recorded.');
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (!latestFx) return;
    setBusy(true);
    setMessage('');
    try {
      const next = await createPriceReview(role, {
        supplierId,
        fxSnapshotId: latestFx.id,
        newUnitCost: { amountMinor: Math.round(Number(cost) * 100), currency: 'USD' },
        targetMarginBps: Math.round(Number(target) * 100),
        effectiveAt: new Date().toISOString(),
        reason: 'New supplier quote recorded in Price Studio',
      });
      setReview(next);
      setSelected(next.items.map((item) => item.id));
      setMessage('Supplier cost recorded. Customer prices have not changed yet.');
      refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Impact review could not be created.');
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!review || selected.length === 0) return;
    setBusy(true);
    try {
      const next = await approvePriceReview(role, review.id, {
        itemIds: selected,
        reason: 'Owner approved selected recommendations in Price Studio',
      });
      setReview(next);
      setSelected([]);
      setMessage(
        `${selected.length} selected selling price change${selected.length === 1 ? '' : 's'} approved; history preserved.`,
      );
      refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Prices could not be approved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Decision workspace"
        title="Price Studio"
        detail="Record local cost and currency facts, see the margin impact immediately, then decide which customer prices should change. Masaar never changes prices silently."
      />
      <div className="mt-7 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-gold-soft text-warning-strong">
                <BadgeDollarSign className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-brand-navy">
                  Owner FX reference
                </h2>
                <p className="text-xs text-ink-muted">
                  Explicit snapshot, never a hidden live feed
                </p>
              </div>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              LBP per 1 USD
              <input
                aria-label="LBP per 1 USD"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                type="number"
                className={controlClass}
              />
            </label>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              disabled={!canManagePricing(role) || busy}
              onClick={recordFx}
            >
              <Save className="size-4" />
              Record reference
            </Button>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-bold text-brand-navy">New supplier cost</h2>
            <p className="mt-1 text-sm leading-5 text-ink-muted">
              This records the new cost first. Selling prices remain unchanged until you approve
              recommendations.
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Supplier
              <select
                aria-label="Supplier for cost review"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className={controlClass}
              >
                {data.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                New unit cost (USD)
                <input
                  aria-label="New unit cost"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  type="number"
                  step="0.01"
                  className={controlClass}
                />
              </label>
              <label className="text-sm font-semibold">
                Target margin %
                <input
                  aria-label="Target margin"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  type="number"
                  className={controlClass}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              {affectedCount} linked variant{affectedCount === 1 ? '' : 's'} will be compared.
            </p>
            <Button
              className="mt-4 w-full"
              disabled={!canManagePricing(role) || busy || !supplierId}
              onClick={preview}
            >
              <Sparkles className="size-4" />
              Record cost & preview impact
            </Button>
          </Card>
        </div>
        <Card>
          {review ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                    Latest impact review
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-brand-navy">
                    {review.supplierName}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Target margin {(review.targetMarginBps / 100).toFixed(0)}% · FX snapshot locked
                  </p>
                </div>
                <StatusBadge tone={review.status === 'APPROVED' ? 'success' : 'warning'}>
                  {review.status.replace('_', ' ')}
                </StatusBadge>
              </div>
              <div className="mt-6 space-y-3">
                {review.items.map((item) => (
                  <label
                    key={item.id}
                    className={`block rounded-xl border p-4 ${item.approved ? 'border-success-strong/30 bg-success-soft' : 'border-border bg-surface-muted'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`Approve ${item.sku}`}
                        type="checkbox"
                        disabled={item.approved || !canManagePricing(role)}
                        checked={item.approved || selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                        className="mt-1 size-4 accent-brand-teal"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <strong className="text-brand-navy">{item.productName}</strong>
                            <div className="font-mono text-xs text-ink-muted">{item.sku}</div>
                          </div>
                          {item.approved && (
                            <StatusBadge tone="success">
                              <Check className="mr-1 size-3" />
                              Approved
                            </StatusBadge>
                          )}
                        </div>
                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <ImpactValue
                            label="Current price"
                            value={formatMoney(item.currentSellingPrice)}
                          />
                          <ArrowRight className="size-4 text-brand-gold" />
                          <ImpactValue
                            label="Recommended"
                            value={formatMoney(item.recommendedSellingPrice)}
                            strong
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                          <span className="text-ink-muted">Margin after new cost</span>
                          <span
                            className={
                              item.newMarginBps < 2500
                                ? 'font-bold text-danger-strong'
                                : 'font-bold text-success-strong'
                            }
                          >
                            {(item.oldMarginBps / 100).toFixed(1)}% →{' '}
                            {(item.newMarginBps / 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <Button
                className="mt-5 w-full"
                disabled={!canManagePricing(role) || busy || selected.length === 0}
                onClick={approve}
              >
                <Check className="size-4" />
                Approve {selected.length} selected price{selected.length === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title="No price impact review yet"
              detail="Record a supplier cost to see exactly which margins and recommended prices would change."
            />
          )}
        </Card>
      </div>
      {message && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-brand-teal-soft px-4 py-3 text-sm font-semibold text-brand-teal-deep"
        >
          {message}
        </div>
      )}
    </>
  );
}

type ViewProps = { data: CommerceSnapshot; role: Role; refresh: () => void };
type FormProps = { data: CommerceSnapshot; role: Role; close: () => void; saved: () => void };
const controlClass =
  'mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal-soft';

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string },
) {
  const { label, ...input } = props;
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input {...input} className={controlClass} />
    </label>
  );
}
function Drawer({
  title,
  detail,
  close,
  children,
}: {
  title: string;
  detail: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex justify-end bg-brand-navy/45"
    >
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-navy">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-ink-muted">{detail}</p>
          </div>
          <button
            aria-label="Close form"
            className="rounded-lg p-2 hover:bg-surface-muted"
            onClick={close}
          >
            <X />
          </button>
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}
function MiniStat({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div
          className={`grid size-10 place-items-center rounded-xl ${warning ? 'bg-warning-soft text-warning-strong' : 'bg-brand-teal-soft text-brand-teal-deep'}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-muted">{label}</p>
          <p className="font-display text-2xl font-bold text-brand-navy">{value}</p>
        </div>
      </div>
    </Card>
  );
}
function CustomerStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <strong className="font-display text-lg text-brand-navy">{value}</strong>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}
function SupplierStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <Icon className="size-4 text-brand-teal-deep" />
      <p className="mt-3 text-[11px] text-ink-muted">{label}</p>
      <strong className="mt-1 block text-sm text-brand-navy">{value}</strong>
    </div>
  );
}
function ImpactValue({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p
        className={
          strong ? 'mt-1 font-bold text-brand-teal-deep' : 'mt-1 font-semibold text-brand-navy'
        }
      >
        {value}
      </p>
    </div>
  );
}
function FormError({ message }: { message: string }) {
  return message ? (
    <div
      role="alert"
      className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger-strong"
    >
      <AlertTriangle className="size-5 shrink-0" />
      {message}
    </div>
  ) : null;
}
function CommerceLoading({ view }: { view: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <span className="sr-only">Loading {view}</span>
    </div>
  );
}
function CommerceError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <EmptyState
          icon={<RefreshCw className="size-6" />}
          title="Commerce data is unavailable"
          detail={`${message} No changes are being accepted until the server reconnects.`}
        />
        <Button className="mx-auto mt-4 flex" onClick={retry}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </Card>
    </div>
  );
}
function formatMoney(value: Money) {
  return value.currency === 'USD'
    ? `$${(value.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${value.amountMinor.toLocaleString()} LBP`;
}
function calculateMargin(price: Money, cost: Money, fx: number) {
  const usd = (value: Money) =>
    value.currency === 'USD' ? value.amountMinor : (value.amountMinor / fx) * 100;
  const selling = usd(price);
  return selling <= 0 ? -100 : ((selling - usd(cost)) / selling) * 100;
}
