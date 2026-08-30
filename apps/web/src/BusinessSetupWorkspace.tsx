import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  BusinessSettings,
  DeliveryResource,
  DeliveryResourceType,
  DeliveryZone,
  FulfillmentSnapshot,
  InviteTeamMember,
  Role,
  TeamMember,
} from '@masaar/contracts';
import { Button, Card, Skeleton, StatusBadge } from '@masaar/ui';
import {
  ArrowRight,
  Building2,
  Check,
  MapPinned,
  Pencil,
  Plus,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  createDeliveryResource,
  createDeliveryZone,
  getBusinessSettings,
  getCommerceSnapshot,
  getFulfillmentSnapshot,
  getTeam,
  inviteTeamMember,
  updateDeliveryResource,
  updateDeliveryZone,
  updateBusinessSettings,
} from './api';

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
const field = 'field mt-1 bg-white';
const nice = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
const formatFee = (amountMinor: number, currency: 'USD' | 'LBP') =>
  currency === 'USD' ? `$${(amountMinor / 100).toFixed(2)}` : `${amountMinor.toLocaleString()} LBP`;

export function BusinessSetupWorkspace({
  role,
  onOpenCatalog,
}: {
  role: Role;
  onOpenCatalog: () => void;
}) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [fulfillment, setFulfillment] = useState<FulfillmentSnapshot | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [panel, setPanel] = useState<'COMPANY' | 'TEAM' | 'DELIVERY'>('COMPANY');
  const [message, setMessage] = useState('');
  const canEditCompany = role === 'OWNER';
  async function reload() {
    const [nextSettings, nextTeam, nextFulfillment, commerce] = await Promise.all([
      getBusinessSettings(role),
      getTeam(role),
      getFulfillmentSnapshot(role),
      getCommerceSnapshot(role),
    ]);
    setSettings(nextSettings);
    setTeam(nextTeam);
    setFulfillment(nextFulfillment);
    setProductCount(commerce.products.length);
  }
  useEffect(() => {
    void reload();
  }, [role]);
  const progress = useMemo(() => {
    const checks = [
      Boolean(settings?.businessName),
      productCount > 0,
      team.length > 1,
      Boolean(fulfillment?.resources.length),
      Boolean(fulfillment?.zones.length),
    ];
    return { checks, completed: checks.filter(Boolean).length };
  }, [settings, productCount, team, fulfillment]);
  const panels: { id: typeof panel; title: string; Icon: typeof Building2 }[] = [
    { id: 'COMPANY', title: 'Company profile', Icon: Building2 },
    { id: 'TEAM', title: 'People & access', Icon: Users },
    { id: 'DELIVERY', title: 'Delivery setup', Icon: Truck },
  ];
  if (!settings || !fulfillment)
    return (
      <div className="mx-auto max-w-[1400px] space-y-4">
        <Skeleton className="h-56 rounded-[30px]" />
        <Skeleton className="h-96" />
      </div>
    );
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <section className="tech-grid relative overflow-hidden rounded-[30px] bg-brand-navy p-7 text-white shadow-2xl md:p-9">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
              Business setup
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold">
              Make Masaar match the real company.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
              Configure the business once. Products, people, delivery coverage and permissions then
              drive every operational screen automatically.
            </p>
          </div>
          <div className="min-w-64 rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex items-end justify-between">
              <span className="text-xs font-bold text-white/55">Setup readiness</span>
              <strong className="font-display text-2xl text-brand-teal">
                {progress.completed}/5
              </strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand-teal transition-all"
                style={{ width: `${progress.completed * 20}%` }}
              />
            </div>
          </div>
        </div>
      </section>
      {message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-brand-teal/20 bg-brand-teal-soft p-4 text-sm font-semibold text-brand-teal-deep"
        >
          <Check className="mt-0.5 size-4 shrink-0" />
          {message}
        </div>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Business profile', progress.checks[0], 'Company'],
          [
            'First product',
            progress.checks[1],
            productCount ? `${productCount} products` : 'Open catalog',
          ],
          ['Team access', progress.checks[2], `${team.length} users`],
          ['Delivery partners', progress.checks[3], `${fulfillment.resources.length} configured`],
          ['Fee zones', progress.checks[4], `${fulfillment.zones.length} configured`],
        ].map(([title, done, detail]) => (
          <Card
            key={String(title)}
            className={done ? 'border-brand-teal/20' : 'border-brand-gold/30'}
          >
            <div
              className={`grid size-7 place-items-center rounded-lg ${done ? 'bg-success-soft text-success-strong' : 'bg-warning-soft text-warning-strong'}`}
            >
              {done ? <Check className="size-4" /> : <span className="text-xs font-bold">!</span>}
            </div>
            <p className="mt-3 text-sm font-bold text-brand-navy">{title}</p>
            <p className="mt-1 text-xs text-ink-muted">{detail}</p>
          </Card>
        ))}
      </section>
      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <nav className="space-y-2">
          {panels.map(({ id, title, Icon }) => (
            <button
              key={id}
              onClick={() => setPanel(id)}
              className={`clickable-surface flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold ${panel === id ? 'border-brand-teal bg-brand-teal-soft text-brand-teal-deep shadow-[inset_0_1px_0_white,0_6px_0_-3px_rgba(0,168,156,.3)]' : 'border-border bg-white text-brand-navy'}`}
            >
              <Icon className="size-5" />
              {title}
              <ArrowRight className="ml-auto size-4" />
            </button>
          ))}
        </nav>
        {panel === 'COMPANY' ? (
          <CompanyPanel
            settings={settings}
            canEdit={canEditCompany}
            role={role}
            onSaved={(next) => {
              setSettings(next);
              setMessage('Business profile saved. These settings now apply across the workspace.');
            }}
          />
        ) : panel === 'TEAM' ? (
          <TeamPanel
            role={role}
            team={team}
            onInvited={async (text) => {
              setMessage(text);
              await reload();
            }}
          />
        ) : (
          <DeliveryPanel
            role={role}
            snapshot={fulfillment}
            onChanged={async (text) => {
              setMessage(text);
              await reload();
            }}
          />
        )}
      </div>
      {productCount === 0 && (
        <Card className="flex flex-col justify-between gap-4 border-brand-gold/30 bg-brand-gold-soft/40 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-brand-navy">Products are the final operational input.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Add a product, variants, price and optional stock; Masaar will use them in order
              capture.
            </p>
          </div>
          <Button onClick={onOpenCatalog}>
            Open catalog <ArrowRight className="size-4" />
          </Button>
        </Card>
      )}
    </div>
  );
}

function CompanyPanel({
  settings,
  canEdit,
  role,
  onSaved,
}: {
  settings: BusinessSettings;
  canEdit: boolean;
  role: Role;
  onSaved: (value: BusinessSettings) => void;
}) {
  const [name, setName] = useState(settings.businessName);
  const [base, setBase] = useState<'USD' | 'LBP'>(settings.baseCurrency);
  const [lowConnectivity, setLowConnectivity] = useState(settings.lowConnectivityMode);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onSaved(
        await updateBusinessSettings(role, {
          businessName: name,
          baseCurrency: base,
          enabledCurrencies: ['USD', 'LBP'],
          lowConnectivityMode: lowConnectivity,
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Header
        icon={Building2}
        title="Company profile"
        detail="One source for the name, currencies and Lebanon connectivity behavior used throughout Masaar."
      />
      <form onSubmit={(event) => void submit(event)} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink-muted sm:col-span-2">
          Business name
          <input
            disabled={!canEdit}
            required
            className={field}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="text-xs font-bold text-ink-muted">
          Operating currency
          <select
            disabled={!canEdit}
            className={field}
            value={base}
            onChange={(event) => setBase(event.target.value as 'USD' | 'LBP')}
          >
            <option>USD</option>
            <option>LBP</option>
          </select>
        </label>
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-start gap-3 text-sm font-bold text-brand-navy">
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={lowConnectivity}
              onChange={(event) => setLowConnectivity(event.target.checked)}
              className="mt-1"
            />
            <span>
              Low-connectivity protection
              <span className="mt-1 block text-xs font-normal leading-5 text-ink-muted">
                Keep offline-aware behavior and honest sync states enabled.
              </span>
            </span>
          </label>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button disabled={!canEdit || busy}>
            {canEdit ? 'Save company profile' : 'Only the owner can edit'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TeamPanel({
  role,
  team,
  onInvited,
}: {
  role: Role;
  team: TeamMember[];
  onInvited: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InviteTeamMember>({
    displayName: '',
    email: '',
    role: 'EMPLOYEE',
    phone: '',
  });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await inviteTeamMember(role, form);
      setOpen(false);
      setForm({ displayName: '', email: '', role: 'EMPLOYEE', phone: '' });
      await onInvited(
        `${result.member.displayName} can now sign in as ${nice(result.member.role)}. Temporary password: ${result.temporaryPassword}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <Header
          icon={Users}
          title="People and access"
          detail="Invite the person, choose the job, and Masaar exposes only the tools that job needs."
        />
        <Button onClick={() => setOpen(!open)}>
          <UserPlus className="size-4" /> Add person
        </Button>
      </div>
      {open && (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2"
        >
          <label className="text-xs font-bold text-ink-muted">
            Full name
            <input
              required
              className={field}
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-ink-muted">
            Work email
            <input
              required
              type="email"
              className={field}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-ink-muted">
            Role
            <select
              className={field}
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as InviteTeamMember['role'] })
              }
            >
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="DRIVER">Driver</option>
              <option value="READ_ONLY">Read-only analyst</option>
            </select>
          </label>
          <label className="text-xs font-bold text-ink-muted">
            Phone {form.role === 'DRIVER' ? '(required for calls)' : '(optional)'}
            <input
              className={field}
              value={form.phone ?? ''}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <Button disabled={busy}>Create access</Button>
          </div>
        </form>
      )}
      <div className="mt-5 divide-y divide-border">
        {team.map((member) => (
          <div key={member.id} className="flex items-center gap-3 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-navy font-bold text-brand-teal">
              {member.displayName[0]}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-navy">{member.displayName}</p>
              <p className="truncate text-xs text-ink-muted">{member.email}</p>
            </div>
            <div className="ml-auto text-right">
              <StatusBadge tone="success">{nice(member.role)}</StatusBadge>
              <p className="mt-1 text-[10px] text-ink-muted">{member.status}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DeliveryPanel({
  role,
  snapshot,
  onChanged,
}: {
  role: Role;
  snapshot: FulfillmentSnapshot;
  onChanged: (text: string) => Promise<void>;
}) {
  const [resourceOpen, setResourceOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [resource, setResource] = useState({
    name: '',
    type: 'COMPANY' as DeliveryResourceType,
    phone: '',
    serviceAreas: '',
    settlementTerms: '',
    active: true,
  });
  const [zone, setZone] = useState({
    name: '',
    governorates: ['Beirut'] as string[],
    areas: '',
    customerFee: '',
    businessCost: '',
    currency: 'USD' as 'USD' | 'LBP',
    estimatedDays: '1',
    active: true,
  });
  function editResource(item: DeliveryResource) {
    setResource({
      name: item.name,
      type: item.type,
      phone: item.phone,
      serviceAreas: item.serviceAreas.join(', '),
      settlementTerms: item.settlementTerms,
      active: item.active,
    });
    setEditingResourceId(item.id);
    setResourceOpen(true);
  }
  function editZone(item: DeliveryZone) {
    setZone({
      name: item.name,
      governorates: item.governorates,
      areas: item.areas.join(', '),
      customerFee:
        item.customerFee.currency === 'USD'
          ? (item.customerFee.amountMinor / 100).toFixed(2)
          : String(item.customerFee.amountMinor),
      businessCost:
        item.businessCost.currency === 'USD'
          ? (item.businessCost.amountMinor / 100).toFixed(2)
          : String(item.businessCost.amountMinor),
      currency: item.customerFee.currency,
      estimatedDays: String(item.estimatedDays),
      active: item.active,
    });
    setEditingZoneId(item.id);
    setZoneOpen(true);
  }
  async function addResource(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: resource.name,
      type: resource.type,
      phone: resource.phone,
      active: resource.active,
      serviceAreas: resource.serviceAreas
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      settlementTerms: resource.settlementTerms,
    };
    if (editingResourceId) await updateDeliveryResource(role, editingResourceId, input);
    else await createDeliveryResource(role, input);
    setResourceOpen(false);
    setEditingResourceId(null);
    await onChanged(
      `${resource.name} ${editingResourceId ? 'updated' : 'added to the delivery network'}.`,
    );
  }
  async function addZone(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: zone.name,
      governorates: zone.governorates,
      areas: zone.areas
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      customerFee: {
        amountMinor:
          zone.currency === 'USD'
            ? Math.round(Number(zone.customerFee) * 100)
            : Math.round(Number(zone.customerFee)),
        currency: zone.currency,
      },
      businessCost: {
        amountMinor:
          zone.currency === 'USD'
            ? Math.round(Number(zone.businessCost) * 100)
            : Math.round(Number(zone.businessCost)),
        currency: zone.currency,
      },
      estimatedDays: Number(zone.estimatedDays),
      active: zone.active,
    };
    if (editingZoneId) await updateDeliveryZone(role, editingZoneId, input);
    else await createDeliveryZone(role, input);
    setZoneOpen(false);
    setEditingZoneId(null);
    await onChanged(
      `${zone.name} ${editingZoneId ? 'updated' : 'added'}. Dispatch now uses this coverage and fee.`,
    );
  }
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <Header
            icon={Truck}
            title="Delivery partners"
            detail="Invite internal drivers under People. Add freelancers and companies here with real coverage and settlement terms."
          />
          <Button
            onClick={() => {
              setEditingResourceId(null);
              setResource({
                name: '',
                type: 'COMPANY',
                phone: '',
                serviceAreas: '',
                settlementTerms: '',
                active: true,
              });
              setResourceOpen(!resourceOpen);
            }}
          >
            <Plus className="size-4" /> Add partner
          </Button>
        </div>
        {resourceOpen && (
          <form
            onSubmit={(event) => void addResource(event)}
            className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2"
          >
            <label className="text-xs font-bold text-ink-muted">
              Partner name
              <input
                required
                className={field}
                value={resource.name}
                onChange={(event) => setResource({ ...resource, name: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Type
              <select
                className={field}
                value={resource.type}
                onChange={(event) =>
                  setResource({ ...resource, type: event.target.value as DeliveryResourceType })
                }
              >
                {resource.type === 'INTERNAL_DRIVER' && (
                  <option value="INTERNAL_DRIVER">Internal driver</option>
                )}
                <option value="COMPANY">Delivery company</option>
                <option value="FREELANCER">Freelance driver</option>
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Phone
              <input
                required
                className={field}
                value={resource.phone}
                onChange={(event) => setResource({ ...resource, phone: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Coverage areas
              <input
                required
                className={field}
                placeholder="Beirut, Metn, all Lebanon"
                value={resource.serviceAreas}
                onChange={(event) => setResource({ ...resource, serviceAreas: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Settlement terms
              <input
                required
                className={field}
                placeholder="Daily COD transfer, weekly invoice…"
                value={resource.settlementTerms}
                onChange={(event) =>
                  setResource({ ...resource, settlementTerms: event.target.value })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-ink-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={resource.active}
                onChange={(event) => setResource({ ...resource, active: event.target.checked })}
              />
              Active and available for new assignments
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <Button>{editingResourceId ? 'Save partner changes' : 'Add delivery partner'}</Button>
            </div>
          </form>
        )}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {snapshot.resources.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-brand-navy">{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    {nice(item.type)} · {item.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={item.active ? 'success' : 'warning'}>
                    {item.active ? 'Active' : 'Paused'}
                  </StatusBadge>
                  <Button
                    variant="secondary"
                    aria-label={`Edit delivery partner ${item.name}`}
                    onClick={() => editResource(item)}
                  >
                    <Pencil className="size-4" /> Edit
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Coverage: {item.serviceAreas.join(', ')}
              </p>
              <p className="mt-1 text-xs font-semibold text-brand-navy">{item.settlementTerms}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <Header
            icon={MapPinned}
            title="Lebanese delivery zones"
            detail="All eight governorates are supported. Add common localities to a zone, and customer addresses can still use any custom locality."
          />
          <Button
            onClick={() => {
              setEditingZoneId(null);
              setZone({
                name: '',
                governorates: ['Beirut'],
                areas: '',
                customerFee: '',
                businessCost: '',
                currency: 'USD',
                estimatedDays: '1',
                active: true,
              });
              setZoneOpen(!zoneOpen);
            }}
          >
            <Plus className="size-4" /> Add fee zone
          </Button>
        </div>
        {zoneOpen && (
          <form
            onSubmit={(event) => void addZone(event)}
            className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2"
          >
            <label className="text-xs font-bold text-ink-muted">
              Zone name
              <input
                required
                className={field}
                placeholder="Coastal North"
                value={zone.name}
                onChange={(event) => setZone({ ...zone, name: event.target.value })}
              />
            </label>
            <fieldset className="sm:col-span-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-bold text-ink-muted">
                Governorates covered
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOVERNORATES.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs font-semibold text-brand-navy"
                  >
                    <input
                      type="checkbox"
                      checked={zone.governorates.includes(item)}
                      onChange={(event) =>
                        setZone({
                          ...zone,
                          governorates: event.target.checked
                            ? [...zone.governorates, item]
                            : zone.governorates.filter((candidate) => candidate !== item),
                        })
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Areas and localities
              <input
                required
                className={field}
                placeholder="Tripoli, Mina, Zgharta…"
                value={zone.areas}
                onChange={(event) => setZone({ ...zone, areas: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted sm:col-span-2">
              Fee currency
              <select
                className={field}
                value={zone.currency}
                onChange={(event) =>
                  setZone({
                    ...zone,
                    currency: event.target.value as 'USD' | 'LBP',
                    customerFee: '',
                    businessCost: '',
                  })
                }
              >
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Customer delivery fee ({zone.currency})
              <input
                required
                type="number"
                min="0"
                step={zone.currency === 'USD' ? '0.01' : '1000'}
                className={field}
                value={zone.customerFee}
                onChange={(event) => setZone({ ...zone, customerFee: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Your courier cost ({zone.currency})
              <input
                required
                type="number"
                min="0"
                step={zone.currency === 'USD' ? '0.01' : '1000'}
                className={field}
                value={zone.businessCost}
                onChange={(event) => setZone({ ...zone, businessCost: event.target.value })}
              />
            </label>
            <label className="text-xs font-bold text-ink-muted">
              Expected days
              <input
                required
                type="number"
                min="1"
                className={field}
                value={zone.estimatedDays}
                onChange={(event) => setZone({ ...zone, estimatedDays: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-ink-muted">
              <input
                type="checkbox"
                checked={zone.active}
                onChange={(event) => setZone({ ...zone, active: event.target.checked })}
              />
              Active for dispatch
            </label>
            <div className="flex items-end justify-end">
              <Button>{editingZoneId ? 'Save zone changes' : 'Add fee zone'}</Button>
            </div>
          </form>
        )}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="pb-3">Zone</th>
                <th>Coverage</th>
                <th>Customer fee</th>
                <th>Courier cost</th>
                <th>ETA</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.zones.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3 font-bold text-brand-navy">{item.name}</td>
                  <td>
                    {item.governorates.join(', ')}
                    <span className="block text-xs text-ink-muted">
                      {item.areas.join(', ') || 'Any locality'}
                    </span>
                  </td>
                  <td>{formatFee(item.customerFee.amountMinor, item.customerFee.currency)}</td>
                  <td>{formatFee(item.businessCost.amountMinor, item.businessCost.currency)}</td>
                  <td>{item.estimatedDays} day(s)</td>
                  <td className="text-right">
                    <Button
                      variant="secondary"
                      aria-label={`Edit delivery zone ${item.name}`}
                      onClick={() => editZone(item)}
                    >
                      <Pencil className="size-4" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Building2;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-teal-soft text-brand-teal-deep">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-display text-2xl font-bold text-brand-navy">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}
