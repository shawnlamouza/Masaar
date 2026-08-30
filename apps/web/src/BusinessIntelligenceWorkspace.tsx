import { useEffect, useMemo, useState } from 'react';
import type { IntelligencePeriod, IntelligenceSnapshot, Role } from '@masaar/contracts';
import { Button, Card, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  BrainCircuit,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Compass,
  Lightbulb,
  PackageSearch,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getIntelligenceSnapshot } from './api';

export type IntelligenceTarget = IntelligenceSnapshot['insights'][number]['target'];

const PERIODS: { value: IntelligencePeriod; label: string }[] = [
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '90D', label: '90 days' },
];
const CHANNEL_LABEL: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  WEBSITE: 'Website',
  PHONE: 'Phone',
  STORE: 'Store',
  ORDER_LINK: 'Order link',
};

const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
const humanReason = (reason: string) =>
  reason
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

export function BusinessIntelligenceWorkspace({
  role,
  onOpenView,
}: {
  role: Role;
  onOpenView: (view: IntelligenceTarget) => void;
}) {
  const [period, setPeriod] = useState<IntelligencePeriod>('30D');
  const [reloadKey, setReloadKey] = useState(0);
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSeries, setActiveSeries] = useState<'revenue' | 'grossProfit' | 'collected'>(
    'revenue',
  );
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    getIntelligenceSnapshot(role, period)
      .then((value) => {
        if (live) setSnapshot(value);
      })
      .catch((reason: Error) => {
        if (live) setError(reason.message || 'Business Intelligence could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [period, reloadKey, role]);

  const trend = useMemo(
    () =>
      snapshot?.trend.map((point) => ({
        ...point,
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        revenue: point.revenueMinor / 100,
        grossProfit: point.grossProfitMinor / 100,
        collected: point.collectedMinor / 100,
      })) ?? [],
    [snapshot],
  );

  if (loading && !snapshot) return <IntelligenceLoading />;
  if (error || !snapshot)
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-danger-strong/20 p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-danger-strong" />
          <h1 className="mt-4 font-display text-2xl font-bold text-brand-navy">
            Intelligence is temporarily unavailable
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <Button className="mt-5" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </Card>
      </div>
    );

  const leadInsight = snapshot.insights[0];
  const grossProfit = snapshot.cash.recognizedRevenueMinor
    ? Math.round(
        ((snapshot.metrics.find((item) => item.id === 'gross-margin')?.value ?? 0) *
          snapshot.cash.recognizedRevenueMinor) /
          100,
      )
    : 0;
  const cogs = Math.max(0, snapshot.cash.recognizedRevenueMinor - grossProfit);
  const maxCash = Math.max(
    snapshot.cash.recognizedRevenueMinor,
    snapshot.cash.inventoryValueMinor,
    1,
  );

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <section className="intelligence-stage depth-stage relative overflow-hidden rounded-[30px] bg-brand-navy text-white">
        <div className="intelligence-orbit intelligence-orbit-one" />
        <div className="intelligence-orbit intelligence-orbit-two" />
        <div className="relative grid min-h-[345px] gap-8 p-7 md:p-10 xl:grid-cols-[1.15fr_.85fr]">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
                <BrainCircuit className="size-4" /> Phase 7 · Decision intelligence
              </p>
              <StatusBadge tone={snapshot.dataMode === 'LIVE' ? 'success' : 'info'}>
                {snapshot.dataMode === 'LIVE'
                  ? 'Live business data'
                  : 'Demo history + live actions'}
              </StatusBadge>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-[-.045em] md:text-6xl">
              The business,
              <br />
              <span className="text-brand-teal">decoded into decisions.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
              Revenue is not cash. Orders are not profit. Masaar connects sales, product cost,
              delivery outcomes, payment custody, customers and stock—then explains what the owner
              should do next.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPeriod(item.value)}
                  className={`action-button rounded-xl border px-4 py-2 text-xs font-bold ${period === item.value ? 'border-brand-teal bg-brand-teal text-brand-navy shadow-[0_7px_0_-4px_rgba(0,168,156,.7)]' : 'border-white/15 bg-white/6 text-white/65 hover:bg-white/12 hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
              <span className="ml-1 flex items-center gap-1.5 text-[11px] text-white/45">
                <Clock3 className="size-3.5" /> Updated{' '}
                {new Date(snapshot.generatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          {leadInsight && (
            <div className="flex items-center">
              <div className="insight-prism w-full rounded-[26px] border border-white/12 bg-white/8 p-5 backdrop-blur-md md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-gold text-brand-navy shadow-[0_10px_28px_rgba(224,173,80,.25)]">
                    <Zap className="size-5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-gold">
                    First decision
                  </span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold leading-tight">
                  {leadInsight.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">{leadInsight.explanation}</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-brand-navy/60 p-3">
                  <p className="text-xs font-bold text-brand-teal">{leadInsight.impact}</p>
                  <p className="mt-1 text-xs text-white/55">{leadInsight.recommendation}</p>
                </div>
                <Button
                  onClick={() => onOpenView(leadInsight.target)}
                  className="gold-action mt-4 w-full text-brand-navy"
                >
                  Take action in {leadInsight.target} <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.metrics.map((metric, index) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            index={index}
            expanded={expandedMetric === metric.id}
            onToggle={() => setExpandedMetric(expandedMetric === metric.id ? null : metric.id)}
          />
        ))}
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-start md:justify-between md:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Business pulse
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Revenue, profit and cash—separately
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Hover any point to see its exact period value.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1">
              {(
                [
                  ['revenue', 'Revenue'],
                  ['grossProfit', 'Gross profit'],
                  ['collected', 'Collected'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setActiveSeries(value)}
                  className={`action-button rounded-lg px-3 py-2 text-[11px] font-bold ${activeSeries === value ? 'bg-white text-brand-navy shadow-sm' : 'text-ink-muted hover:text-brand-navy'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[340px] px-2 pb-4 pt-5 md:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="intelligenceArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00a89c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00a89c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dce8e7" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#708080', fontSize: 11 }}
                  minTickGap={28}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#708080', fontSize: 11 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  content={<MoneyTooltip />}
                  cursor={{ stroke: '#00a89c', strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey={activeSeries}
                  stroke="#00a89c"
                  strokeWidth={3}
                  fill="url(#intelligenceArea)"
                  animationDuration={700}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  yAxisId="right"
                  stroke="#e0ad50"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <YAxis yAxisId="right" orientation="right" hide domain={[0, 'auto']} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/65 px-5 py-3 text-[11px] text-ink-muted">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-teal" /> Selected money series
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-5 bg-brand-gold" /> Order volume
            </span>
            <span>{snapshot.periodLabel} · USD-equivalent view</span>
          </div>
        </Card>

        <Card className="depth-stage overflow-hidden border-0 bg-brand-navy text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal">
            Money truth
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">Where every sales dollar sits</h2>
          <div className="mt-6 space-y-5">
            <MoneyRail
              label="Recognized revenue"
              value={snapshot.cash.recognizedRevenueMinor}
              max={maxCash}
              color="bg-brand-teal"
            />
            <MoneyRail label="Product cost" value={cogs} max={maxCash} color="bg-[#7cb9e8]" />
            <MoneyRail
              label="Gross profit"
              value={grossProfit}
              max={maxCash}
              color="bg-brand-gold"
            />
            <MoneyRail
              label="Collected"
              value={snapshot.cash.collectedMinor}
              max={maxCash}
              color="bg-[#75e4bd]"
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <MoneyTile label="Still outstanding" value={snapshot.cash.outstandingMinor} warning />
            <MoneyTile label="Held by people" value={snapshot.cash.cashHeldMinor} warning />
            <MoneyTile label="Cash in stock" value={snapshot.cash.inventoryValueMinor} />
            <MoneyTile label="Restock estimate" value={snapshot.cash.suggestedRestockMinor} />
          </div>
          <p className="mt-4 text-[10px] leading-4 text-white/42">
            Gross profit excludes delivery, packaging, ads and overhead until those costs are
            recorded.
          </p>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
              Decision queue
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-navy">Do this next</h2>
          </div>
          <span className="hidden text-xs text-ink-muted md:block">
            Ranked by money, urgency and actionability
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {snapshot.insights.map((insight, index) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              rank={index + 1}
              onOpen={() => onOpenView(insight.target)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden p-0">
          <div className="p-6 pb-2">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
              Channel economics
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
              Where profitable demand originates
            </h2>
          </div>
          <div className="h-[310px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={snapshot.channels.map((item) => ({
                  ...item,
                  name: CHANNEL_LABEL[item.channel],
                  revenue: item.revenueMinor / 100,
                  profit: item.grossProfitMinor / 100,
                }))}
                layout="vertical"
                margin={{ top: 15, right: 28, left: 20, bottom: 0 }}
              >
                <CartesianGrid stroke="#e4eceb" strokeDasharray="4 6" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#102d36', fontSize: 11, fontWeight: 700 }}
                />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f0f7f6' }} />
                <Bar dataKey="revenue" fill="#d5e6e4" radius={[0, 7, 7, 0]} barSize={19} />
                <Bar dataKey="profit" fill="#00a89c" radius={[0, 7, 7, 0]} barSize={19} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border bg-surface-muted px-5 py-3 text-[11px] text-ink-muted">
            Revenue in pale teal · gross profit in Masaar teal
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-start justify-between p-6 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Product truth
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                What sells, earns and ties up stock
              </h2>
            </div>
            <PackageSearch className="size-7 text-brand-teal" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="border-y border-border bg-surface-muted text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-3 py-3">Revenue</th>
                  <th className="px-3 py-3">Margin</th>
                  <th className="px-3 py-3">Available</th>
                  <th className="px-6 py-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.products.map((product) => (
                  <tr key={product.productId} className="border-b border-border last:border-0">
                    <td className="px-6 py-4">
                      <strong className="block text-sm text-brand-navy">
                        {product.productName}
                      </strong>
                      <span className="text-[11px] text-ink-muted">
                        {product.units} recognized units
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm font-bold text-brand-navy">
                      {money(product.revenueMinor)}
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-sm font-bold text-brand-teal-deep">
                        {product.marginPercent}%
                      </span>
                      <span className="block text-[10px] text-ink-muted">
                        {money(product.grossProfitMinor)} profit
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm font-bold text-brand-navy">
                      {product.availableUnits}
                      <span className="block text-[10px] font-normal text-ink-muted">
                        {product.stockCoverDays === null
                          ? 'No velocity'
                          : `${product.stockCoverDays}d cover`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ProductSignal signal={product.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Lebanon delivery map
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Areas that grow—and areas that leak
              </h2>
            </div>
            <Compass className="size-7 text-brand-teal" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {snapshot.areas.slice(0, 6).map((area) => (
              <div
                key={`${area.governorate}-${area.area}`}
                className="rounded-2xl border border-border bg-surface-muted/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-sm text-brand-navy">{area.area}</strong>
                    <p className="text-[10px] text-ink-muted">{area.governorate}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${area.deliverySuccessPercent >= 85 ? 'bg-success-soft text-success-strong' : 'bg-warning-soft text-warning-strong'}`}
                  >
                    {area.deliverySuccessPercent}% delivered
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-brand-teal"
                    style={{ width: `${area.deliverySuccessPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-ink-muted">
                  <span>{area.orders} orders</span>
                  <span>{money(area.revenueMinor)} revenue</span>
                  <span>{area.failedDeliveries} failed</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
            Delivery health
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
            Outcome before volume
          </h2>
          <div className="relative mx-auto mt-2 h-48 max-w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Delivered', value: snapshot.delivery.delivered },
                    {
                      name: 'Failed',
                      value: Math.max(0, snapshot.delivery.attempted - snapshot.delivery.delivered),
                    },
                  ]}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={4}
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#00a89c" />
                  <Cell fill="#f1dba9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <strong className="font-display text-3xl text-brand-navy">
                  {snapshot.delivery.successPercent}%
                </strong>
                <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                  success
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniFact
              label="First attempt"
              value={`${snapshot.delivery.firstAttemptSuccessPercent}%`}
            />
            <MiniFact label="Known delivery cost" value={money(snapshot.delivery.knownCostMinor)} />
          </div>
          {snapshot.failureMix.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Failure reasons
              </p>
              {snapshot.failureMix.map((item) => (
                <div key={item.reason} className="mt-2 flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink-muted">
                    {humanReason(item.reason)}
                  </span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full bg-danger-strong"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <strong className="w-9 text-right text-brand-navy">{item.percent}%</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <Card className="metric-depth">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Customer engine
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Retention without guessing
              </h2>
            </div>
            <Users className="size-7 text-brand-teal" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <MiniFact label="Active customers" value={String(snapshot.customers.activeCustomers)} />
            <MiniFact label="Repeat buyers" value={String(snapshot.customers.repeatCustomers)} />
            <MiniFact
              label="Observed value"
              value={money(snapshot.customers.estimatedLifetimeValueMinor)}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-muted">
            Observed customer value is period revenue per identified customer—not a prediction.
            Forecast & AI adds caution signals only when sufficient customer history exists.
          </p>
          <Button
            variant="ghost"
            className="mt-2 px-0 text-brand-teal-deep"
            onClick={() => onOpenView('Customers')}
          >
            Open customer segments <ArrowUpRight className="size-4" />
          </Button>
        </Card>
        <Card className="metric-depth">
          <button
            onClick={() => setMethodOpen(!methodOpen)}
            className="clickable-surface flex w-full items-start justify-between rounded-xl text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Trust layer
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Show me how this was calculated
              </h2>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-brand-teal-soft text-brand-teal-deep">
              <ChevronDown className={`size-5 transition ${methodOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Masaar never hides revenue recognition, currency handling, missing costs or data
            confidence behind an unexplained score.
          </p>
          {methodOpen && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {snapshot.methodology.map((item) => (
                <div key={item} className="flex gap-2 text-xs leading-5 text-ink-muted">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-teal" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function IntelligenceLoading() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <Skeleton className="h-[345px] rounded-[30px]" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <Skeleton className="h-[430px]" />
        <Skeleton className="h-[430px]" />
      </div>
    </div>
  );
}

function MetricCard({
  metric,
  index,
  expanded,
  onToggle,
}: {
  metric: IntelligenceSnapshot['metrics'][number];
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const goodChange =
    metric.changePercent !== null &&
    (metric.direction === 'UP_IS_GOOD'
      ? metric.changePercent >= 0
      : metric.direction === 'DOWN_IS_GOOD'
        ? metric.changePercent <= 0
        : true);
  const display =
    metric.unit === 'MONEY_MINOR'
      ? money(metric.value)
      : metric.unit === 'PERCENT'
        ? `${metric.value}%`
        : String(metric.value);
  const icons = [CircleDollarSign, BadgeDollarSign, Target, Route, WalletCards, Users];
  const Icon = icons[index % icons.length]!;
  return (
    <button
      onClick={onToggle}
      aria-expanded={expanded}
      className="surface-card metric-depth clickable-surface w-full rounded-2xl border border-border bg-white p-5 text-left"
    >
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-teal-soft text-brand-teal-deep">
          <Icon className="size-5" />
        </span>
        {metric.changePercent === null ? (
          <span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-bold text-ink-muted">
            New baseline
          </span>
        ) : (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${goodChange ? 'bg-success-soft text-success-strong' : 'bg-danger-soft text-danger-strong'}`}
          >
            {metric.changePercent >= 0 ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {Math.abs(metric.changePercent)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-semibold text-ink-muted">{metric.label}</p>
      <p className="mt-1 font-display text-3xl font-bold tracking-tight text-brand-navy">
        {display}
      </p>
      <div className="mt-3 flex items-center justify-between text-[10px] text-ink-muted">
        <span>{metric.sourceCount} source records</span>
        <span>{metric.completeness}% complete</span>
      </div>
      {expanded && (
        <div className="mt-4 border-t border-border pt-3 text-xs leading-5 text-ink-muted">
          <p>{metric.definition}</p>
          <p className="mt-2 font-semibold text-brand-teal-deep">
            Previous period:{' '}
            {metric.unit === 'MONEY_MINOR'
              ? money(metric.previousValue)
              : `${metric.previousValue}${metric.unit === 'PERCENT' ? '%' : ''}`}
          </p>
        </div>
      )}
    </button>
  );
}

function MoneyRail({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-white/55">{label}</span>
        <strong>{money(value)}</strong>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.max(2, pct(value, max))}%` }}
        />
      </div>
    </div>
  );
}
function MoneyTile({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${warning && value ? 'border-brand-gold/25 bg-brand-gold/10' : 'border-white/10 bg-white/5'}`}
    >
      <span className="text-[10px] text-white/45">{label}</span>
      <strong
        className={`mt-1 block text-sm ${warning && value ? 'text-brand-gold' : 'text-white'}`}
      >
        {money(value)}
      </strong>
    </div>
  );
}
function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <span className="text-[10px] leading-4 text-ink-muted">{label}</span>
      <strong className="mt-1 block font-display text-lg text-brand-navy">{value}</strong>
    </div>
  );
}
function InsightCard({
  insight,
  rank,
  onOpen,
}: {
  insight: IntelligenceSnapshot['insights'][number];
  rank: number;
  onOpen: () => void;
}) {
  const icon =
    insight.severity === 'CRITICAL'
      ? AlertTriangle
      : insight.severity === 'WARNING'
        ? Target
        : insight.severity === 'OPPORTUNITY'
          ? Lightbulb
          : Sparkles;
  const Icon = icon;
  const tone =
    insight.severity === 'CRITICAL'
      ? 'danger'
      : insight.severity === 'WARNING'
        ? 'warning'
        : insight.severity === 'OPPORTUNITY'
          ? 'success'
          : 'info';
  return (
    <button
      type="button"
      className="surface-card clickable-surface group flex min-h-[290px] flex-col rounded-2xl border border-border bg-white p-5 text-left"
      onClick={onOpen}
    >
      <div className="flex w-full items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-navy text-brand-gold shadow-[0_7px_18px_rgba(0,28,44,.18)]">
          <Icon className="size-5" />
        </span>
        <span className="font-display text-3xl font-bold text-border">0{rank}</span>
      </div>
      <div className="mt-4 w-fit">
        <StatusBadge tone={tone}>{insight.severity.toLowerCase()}</StatusBadge>
      </div>
      <h3 className="mt-3 font-display text-lg font-bold leading-tight text-brand-navy">
        {insight.title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{insight.explanation}</p>
      <div className="mt-auto pt-4">
        <p className="text-xs font-bold text-brand-teal-deep">{insight.impact}</p>
        <span className="mt-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-navy">
          Open {insight.target}
          <ArrowUpRight className="size-3.5 transition group-hover:translate-x-1 group-hover:-translate-y-1" />
        </span>
      </div>
    </button>
  );
}
function ProductSignal({ signal }: { signal: IntelligenceSnapshot['products'][number]['signal'] }) {
  const styles =
    signal === 'WINNER'
      ? 'bg-success-soft text-success-strong'
      : signal === 'RESTOCK'
        ? 'bg-warning-soft text-warning-strong'
        : signal === 'WATCH'
          ? 'bg-danger-soft text-danger-strong'
          : 'bg-surface-muted text-ink-muted';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${styles}`}>{signal}</span>
  );
}
function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-brand-navy/95 p-3 text-white shadow-2xl backdrop-blur">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-gold">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex min-w-40 items-center justify-between gap-4 text-xs">
          <span className="capitalize text-white/55">{item.name.replace(/([A-Z])/g, ' $1')}</span>
          <strong>
            {item.name === 'orders' ? item.value : `$${Number(item.value).toFixed(2)}`}
          </strong>
        </div>
      ))}
    </div>
  );
}
function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}
