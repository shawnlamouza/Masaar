import { useEffect, useMemo, useState } from 'react';
import type {
  AssistantResponse,
  IntelligencePeriod,
  PredictiveSnapshot,
  Role,
} from '@masaar/contracts';
import { Button, Card, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Box,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Compass,
  Gauge,
  Lightbulb,
  MessageSquareText,
  PackagePlus,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { askMasaar, getPredictiveSnapshot } from './api';

type Target =
  | 'Orders'
  | 'Customers'
  | 'Price Studio'
  | 'Delivery'
  | 'Payments'
  | 'Stock Control'
  | 'Returns'
  | 'Intelligence'
  | 'Forecast & AI';

const PERIODS: { value: IntelligencePeriod; label: string }[] = [
  { value: '7D', label: '7-day signal' },
  { value: '30D', label: '30-day signal' },
  { value: '90D', label: '90-day signal' },
];
const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

export function PredictiveWorkspace({
  role,
  onOpenView,
}: {
  role: Role;
  onOpenView: (view: Target) => void;
}) {
  const [period, setPeriod] = useState<IntelligencePeriod>('30D');
  const [reloadKey, setReloadKey] = useState(0);
  const [snapshot, setSnapshot] = useState<PredictiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AssistantResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [growth, setGrowth] = useState(10);
  const [fixedCosts, setFixedCosts] = useState(1500);
  const [marketing, setMarketing] = useState(300);
  const [scenarioTouched, setScenarioTouched] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    getPredictiveSnapshot(role, period)
      .then((value) => {
        if (!live) return;
        setSnapshot(value);
        if (!scenarioTouched) {
          setFixedCosts(value.scenarioDefaults.monthlyFixedCostsMinor / 100);
          setMarketing(value.scenarioDefaults.monthlyMarketingMinor / 100);
        }
      })
      .catch((reason: Error) => {
        if (live) setError(reason.message || 'Predictive intelligence could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [period, reloadKey, role, scenarioTouched]);

  const forecastData = useMemo(
    () =>
      snapshot?.forecast.points.map((point) => ({
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        expected: point.expectedRevenueMinor / 100,
        range: [point.lowRevenueMinor / 100, point.highRevenueMinor / 100],
        orders: point.expectedOrders,
      })) ?? [],
    [snapshot],
  );

  async function submitQuestion(nextQuestion = question) {
    const cleaned = nextQuestion.trim();
    if (!cleaned || asking) return;
    setAssistantOpen(true);
    setQuestion(cleaned);
    setAsking(true);
    try {
      setAnswer(await askMasaar(role, cleaned, period));
    } catch (reason) {
      setAnswer({
        generatedAt: new Date().toISOString(),
        mode: 'GROUNDED_RULE_ENGINE',
        question: cleaned,
        answer: reason instanceof Error ? reason.message : 'Masaar could not answer right now.',
        facts: [],
        actions: [],
        caveat: 'No answer was generated from incomplete data.',
      });
    } finally {
      setAsking(false);
    }
  }

  if (loading && !snapshot) return <PredictiveLoading />;
  if (error || !snapshot)
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-danger-strong/20 p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-danger-strong" />
          <h1 className="mt-4 font-display text-2xl font-bold text-brand-navy">
            Forecast & AI is temporarily unavailable
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <Button className="mt-5" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </Card>
      </div>
    );

  const monthlyRevenue =
    (snapshot.forecast.expectedRevenueMinor / 100) * (30 / 14) * (1 + growth / 100);
  const grossMargin = snapshot.scenarioDefaults.grossMarginPercent;
  const grossProfit = monthlyRevenue * (grossMargin / 100);
  const operatingResult = grossProfit - fixedCosts - marketing;
  const contributionPerOrder =
    (snapshot.scenarioDefaults.averageOrderMinor / 100) * (grossMargin / 100);
  const breakEvenOrders =
    contributionPerOrder > 0 ? Math.ceil((fixedCosts + marketing) / contributionPerOrder) : 0;
  const highRisks = snapshot.deliveryRisks.filter((item) => item.band === 'HIGH').length;
  const restockCash = snapshot.restock.reduce((sum, item) => sum + item.estimatedCashMinor, 0);

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <section className="forecast-stage depth-stage relative overflow-hidden rounded-[30px] text-white">
        <div className="forecast-beam" />
        <div className="relative grid min-h-[365px] gap-7 p-7 md:p-10 xl:grid-cols-[1.18fr_.82fr]">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
                <WandSparkles className="size-4" /> Governed forecasting
              </p>
              <StatusBadge tone={snapshot.forecast.confidence === 'HIGH' ? 'success' : 'warning'}>
                {snapshot.forecast.confidence.toLowerCase()} forecast confidence
              </StatusBadge>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-[-.045em] md:text-6xl">
              See around the corner.
              <br />
              <span className="text-brand-teal">Keep the human in control.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
              Masaar predicts ranges, detects exceptions and explains the evidence. It never changes
              a price, rejects a customer or buys stock without an authorized person.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPeriod(item.value)}
                  className={`action-button rounded-xl border px-4 py-2 text-xs font-bold ${period === item.value ? 'border-brand-teal bg-brand-teal text-brand-navy shadow-[0_7px_0_-4px_rgba(0,168,156,.7)]' : 'border-white/15 bg-white/6 text-white/65 hover:bg-white/12 hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="forecast-crystal w-full rounded-[26px] border border-white/12 bg-white/8 p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-teal text-brand-navy shadow-[0_12px_30px_rgba(0,168,156,.25)]">
                  <TrendingUp className="size-6" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
                  Next 14 days
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold text-white/50">Expected revenue</p>
              <p className="mt-1 font-display text-5xl font-bold text-white">
                {money(snapshot.forecast.expectedRevenueMinor)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ForecastBound
                  label="Conservative"
                  value={money(snapshot.forecast.lowRevenueMinor)}
                />
                <ForecastBound
                  label="Upper range"
                  value={money(snapshot.forecast.highRevenueMinor)}
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                <span className="text-white/50">Expected orders</span>
                <strong className="text-brand-gold">≈ {snapshot.forecast.expectedOrders}</strong>
              </div>
              <Button
                className="gold-action mt-4 w-full text-brand-navy"
                onClick={() => setAssistantOpen(true)}
              >
                <Bot className="size-4" /> Ask Masaar about this forecast
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          icon={Target}
          label="Detected exceptions"
          value={String(snapshot.anomalies.length)}
          detail="Evidence-backed, not silent alarms"
          tone="gold"
        />
        <SignalCard
          icon={PackagePlus}
          label="Forecast restock cash"
          value={money(restockCash)}
          detail={`${snapshot.restock.length} variant decision(s)`}
          tone="teal"
        />
        <SignalCard
          icon={Route}
          label="High-risk areas"
          value={String(highRisks)}
          detail="Confirmation before dispatch"
          tone="rose"
        />
        <SignalCard
          icon={UserRoundCheck}
          label="Customer indicators"
          value={String(snapshot.customerReliability.length)}
          detail="Private caution, never a blacklist"
          tone="blue"
        />
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border p-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Demand horizon
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                A range you can plan around
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Expected value with a volatility-based low-to-high planning band.
              </p>
            </div>
            <span className="rounded-xl bg-brand-teal-soft px-3 py-2 text-[11px] font-bold text-brand-teal-deep">
              {snapshot.forecast.historyDays} history days → 14 forecast days
            </span>
          </div>
          <div className="h-[350px] px-2 pb-4 pt-5 md:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={forecastData}
                margin={{ top: 10, right: 14, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="forecastRange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00a89c" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#00a89c" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dce8e7" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#708080', fontSize: 11 }}
                  minTickGap={20}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#708080', fontSize: 11 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  content={<ForecastTooltip />}
                  cursor={{ stroke: '#00a89c', strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="range"
                  stroke="none"
                  fill="url(#forecastRange)"
                  animationDuration={700}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="#00a89c"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#e0ad50', stroke: '#002c3a', strokeWidth: 2 }}
                  animationDuration={700}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border bg-surface-muted/70 px-6 py-3 text-[11px] text-ink-muted">
            Method: {snapshot.forecast.method}
          </div>
        </Card>

        <Card className="depth-stage border-0 bg-brand-navy text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal">
                Exception radar
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">What broke the pattern?</h2>
            </div>
            <Gauge className="size-7 text-brand-gold" />
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.anomalies.length ? (
              snapshot.anomalies.slice(0, 4).map((anomaly) => (
                <button
                  key={anomaly.id}
                  onClick={() => onOpenView(anomaly.target)}
                  className="action-button group w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/9"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold ${anomaly.severity === 'HIGH' ? 'bg-danger-strong text-white' : 'bg-brand-gold text-brand-navy'}`}
                    >
                      {anomaly.severity}
                    </span>
                    <span className="text-[10px] text-white/40">{anomaly.kind}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-5">{anomaly.title}</h3>
                  <div className="mt-2 flex justify-between text-[10px]">
                    <span className="text-white/45">Observed</span>
                    <strong className="text-brand-gold">{anomaly.observed}</strong>
                  </div>
                  <span className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
                    Investigate in {anomaly.target}
                    <ChevronRight className="size-3.5 transition group-hover:translate-x-1" />
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <CheckCircle2 className="mx-auto size-8 text-brand-teal" />
                <p className="mt-2 text-sm font-bold">No material anomaly detected</p>
                <p className="mt-1 text-xs text-white/45">
                  Masaar will keep watching recorded patterns.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <ScenarioLab
          snapshot={snapshot}
          growth={growth}
          setGrowth={setGrowth}
          fixedCosts={fixedCosts}
          setFixedCosts={setFixedCosts}
          marketing={marketing}
          setMarketing={setMarketing}
          onTouched={() => setScenarioTouched(true)}
          monthlyRevenue={monthlyRevenue}
          grossProfit={grossProfit}
          operatingResult={operatingResult}
          breakEvenOrders={breakEvenOrders}
        />

        <Card className="overflow-hidden p-0">
          <div className="flex items-start justify-between p-6 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Forecast-aware stock
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Buy enough—without trapping cash
              </h2>
            </div>
            <Box className="size-7 text-brand-teal" />
          </div>
          {snapshot.restock.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="border-y border-border bg-surface-muted text-[10px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-6 py-3">Product / SKU</th>
                    <th className="px-3 py-3">Available</th>
                    <th className="px-3 py-3">14d demand</th>
                    <th className="px-3 py-3">Recommendation</th>
                    <th className="px-3 py-3">Cash</th>
                    <th className="px-6 py-3">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.restock.map((item) => (
                    <tr key={item.variantId} className="border-b border-border last:border-0">
                      <td className="px-6 py-4">
                        <strong className="block text-sm text-brand-navy">
                          {item.productName}
                        </strong>
                        <span className="text-[10px] text-ink-muted">{item.sku}</span>
                      </td>
                      <td className="px-3 py-4 text-sm font-bold text-brand-navy">
                        {item.availableUnits}
                      </td>
                      <td className="px-3 py-4 text-sm font-bold text-brand-navy">
                        {item.forecastDemand14Days}
                        <span className="block text-[10px] font-normal text-ink-muted">
                          +{item.safetyUnits} safety
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-strong">
                          Review {item.recommendedUnits}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm font-bold text-brand-teal-deep">
                        {money(item.estimatedCashMinor)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-brand-navy">
                          {item.confidence} confidence
                        </span>
                        <p className="mt-1 max-w-[210px] text-[10px] leading-4 text-ink-muted">
                          {item.explanation}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto size-9 text-brand-teal" />
              <p className="mt-3 font-bold text-brand-navy">Forecast demand is covered</p>
            </div>
          )}
          <div className="border-t border-border bg-surface-muted px-6 py-3">
            <Button
              variant="ghost"
              className="px-0 text-brand-teal-deep"
              onClick={() => onOpenView('Stock Control')}
            >
              Review and receive stock <ArrowRight className="size-4" />
            </Button>
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Delivery risk
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Confirm harder where history says to
              </h2>
            </div>
            <Compass className="size-7 text-brand-teal" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {snapshot.deliveryRisks.slice(0, 6).map((risk) => (
              <div
                key={`${risk.governorate}-${risk.area}`}
                className="rounded-2xl border border-border bg-surface-muted/65 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm text-brand-navy">{risk.area}</strong>
                    <p className="text-[10px] text-ink-muted">
                      {risk.governorate} · {risk.sampleSize} records
                    </p>
                  </div>
                  <RiskBadge band={risk.band} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-ink-muted">Risk score</span>
                    <p className="font-display text-2xl font-bold text-brand-navy">
                      {risk.riskScore}
                      <span className="text-xs text-ink-muted">/100</span>
                    </p>
                  </div>
                  <strong className="text-xs text-warning-strong">
                    {risk.predictedFailurePercent}% failure
                  </strong>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full ${risk.band === 'HIGH' ? 'bg-danger-strong' : risk.band === 'MEDIUM' ? 'bg-brand-gold' : 'bg-brand-teal'}`}
                    style={{ width: `${risk.riskScore}%` }}
                  />
                </div>
                <p className="mt-3 text-[10px] leading-4 text-ink-muted">{risk.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
                Customer reliability
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
                Caution without blacklisting
              </h2>
            </div>
            <UserRoundCheck className="size-7 text-brand-teal" />
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.customerReliability.map((customer) => (
              <div key={customer.customerId} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-sm text-brand-navy">{customer.customerName}</strong>
                    <p className="mt-1 text-[10px] text-ink-muted">
                      {customer.completedOrders} completed · {customer.cancelledOrders} cancelled ·{' '}
                      {customer.failedDeliveries} failed
                    </p>
                  </div>
                  <ReliabilityBadge indicator={customer.indicator} />
                </div>
                <p className="mt-3 text-xs leading-5 text-ink-muted">{customer.explanation}</p>
                <p className="mt-2 text-xs font-semibold text-brand-teal-deep">
                  {customer.recommendation}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex gap-2 rounded-xl bg-brand-teal-soft p-3 text-[10px] leading-4 text-brand-teal-deep">
            <ShieldCheck className="size-4 shrink-0" />
            This indicator never blocks checkout, shares data across businesses or labels a customer
            as bad.
          </p>
        </Card>
      </section>

      <section className="mt-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-teal-soft via-white to-brand-gold-soft/35 p-6 md:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
              <BrainCircuit className="size-4" /> Masaar Assistant
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-brand-navy">
              Ask the business—not the internet.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Every answer cites Masaar facts, offers a safe next action and states what the system
              cannot know.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {snapshot.suggestedQuestions.slice(0, 3).map((item) => (
                <button
                  key={item}
                  onClick={() => void submitQuestion(item)}
                  className="action-button rounded-full border border-brand-teal/20 bg-white px-3 py-2 text-[11px] font-semibold text-brand-navy hover:border-brand-teal"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="gold-action min-w-52 text-brand-navy"
            onClick={() => setAssistantOpen(true)}
          >
            <MessageSquareText className="size-4" /> Open Masaar Assistant
          </Button>
        </div>
      </section>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        {snapshot.governance.limitations.map((item, index) => (
          <div key={item} className="rounded-2xl border border-border bg-white p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-navy text-xs font-bold text-brand-gold">
              0{index + 1}
            </span>
            <p className="mt-3 text-xs leading-5 text-ink-muted">{item}</p>
          </div>
        ))}
      </section>

      {assistantOpen && (
        <AssistantPanel
          snapshot={snapshot}
          question={question}
          setQuestion={setQuestion}
          answer={answer}
          asking={asking}
          onAsk={() => void submitQuestion()}
          onSuggested={(item) => void submitQuestion(item)}
          onClose={() => setAssistantOpen(false)}
          onOpenView={onOpenView}
        />
      )}
    </div>
  );
}

function ScenarioLab({
  snapshot,
  growth,
  setGrowth,
  fixedCosts,
  setFixedCosts,
  marketing,
  setMarketing,
  onTouched,
  monthlyRevenue,
  grossProfit,
  operatingResult,
  breakEvenOrders,
}: {
  snapshot: PredictiveSnapshot;
  growth: number;
  setGrowth: (value: number) => void;
  fixedCosts: number;
  setFixedCosts: (value: number) => void;
  marketing: number;
  setMarketing: (value: number) => void;
  onTouched: () => void;
  monthlyRevenue: number;
  grossProfit: number;
  operatingResult: number;
  breakEvenOrders: number;
}) {
  return (
    <Card className="metric-depth">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
            Founder scenario lab
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-brand-navy">
            What must be true to break even?
          </h2>
        </div>
        <Lightbulb className="size-7 text-brand-teal" />
      </div>
      <p className="mt-2 text-xs leading-5 text-ink-muted">
        Planning math using editable assumptions. This does not rewrite real accounting data.
      </p>
      <div className="mt-5 space-y-5">
        <RangeControl
          label="Sales change"
          value={growth}
          min={-30}
          max={60}
          suffix="%"
          onChange={(value) => {
            onTouched();
            setGrowth(value);
          }}
        />
        <RangeControl
          label="Monthly fixed costs"
          value={fixedCosts}
          min={0}
          max={5000}
          prefix="$"
          step={50}
          onChange={(value) => {
            onTouched();
            setFixedCosts(value);
          }}
        />
        <RangeControl
          label="Monthly marketing"
          value={marketing}
          min={0}
          max={2500}
          prefix="$"
          step={50}
          onChange={(value) => {
            onTouched();
            setMarketing(value);
          }}
        />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <ScenarioTile label="Projected revenue" value={money(Math.round(monthlyRevenue * 100))} />
        <ScenarioTile label="Gross profit" value={money(Math.round(grossProfit * 100))} />
        <ScenarioTile
          label="Operating result"
          value={`${operatingResult < 0 ? '−' : ''}${money(Math.abs(Math.round(operatingResult * 100)))}`}
          warning={operatingResult < 0}
        />
        <ScenarioTile label="Break-even orders" value={String(breakEvenOrders)} />
      </div>
      <p className="mt-4 text-[10px] leading-4 text-ink-muted">
        Uses {snapshot.scenarioDefaults.grossMarginPercent}% observed gross margin and{' '}
        {money(snapshot.scenarioDefaults.averageOrderMinor)} average order value. Taxes, owner
        salary, financing and unrecorded costs are excluded.
      </p>
    </Card>
  );
}

function AssistantPanel({
  snapshot,
  question,
  setQuestion,
  answer,
  asking,
  onAsk,
  onSuggested,
  onClose,
  onOpenView,
}: {
  snapshot: PredictiveSnapshot;
  question: string;
  setQuestion: (value: string) => void;
  answer: AssistantResponse | null;
  asking: boolean;
  onAsk: () => void;
  onSuggested: (value: string) => void;
  onClose: () => void;
  onOpenView: (view: Target) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-brand-navy/45 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Masaar Assistant"
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <header className="forecast-stage flex items-center justify-between p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-teal text-brand-navy">
              <Bot className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Masaar Assistant</h2>
              <p className="text-[10px] text-white/50">Grounded rule engine · your business only</p>
            </div>
          </div>
          <button
            aria-label="Close Masaar Assistant"
            onClick={onClose}
            className="clickable-surface rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl bg-brand-teal-soft p-4">
            <p className="text-xs font-bold text-brand-teal-deep">What I can do</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Explain forecast, cash, stock, delivery and customer signals from recorded Masaar
              data. I cannot browse the market or invent missing expenses.
            </p>
          </div>
          {answer ? (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                You asked
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-navy">{answer.question}</p>
              <div className="mt-4 rounded-2xl border border-border bg-surface-muted/70 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-teal-deep">
                  <Sparkles className="size-4" /> Grounded answer
                </div>
                <p className="mt-3 text-sm leading-6 text-brand-navy">{answer.answer}</p>
                {answer.facts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {answer.facts.map((fact) => (
                      <div key={fact} className="flex gap-2 text-xs text-ink-muted">
                        <CheckCircle2 className="size-4 shrink-0 text-brand-teal" />
                        {fact}
                      </div>
                    ))}
                  </div>
                )}
                {answer.actions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {answer.actions.map((action) => (
                      <Button
                        key={action.label}
                        variant="secondary"
                        onClick={() => {
                          onOpenView(action.target);
                          onClose();
                        }}
                      >
                        {action.label}
                        <ArrowRight className="size-4" />
                      </Button>
                    ))}
                  </div>
                )}
                <p className="mt-4 border-t border-border pt-3 text-[10px] leading-4 text-ink-muted">
                  {answer.caveat}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-xs font-bold text-brand-navy">Try one of these:</p>
              <div className="mt-3 space-y-2">
                {snapshot.suggestedQuestions.map((item) => (
                  <button
                    key={item}
                    onClick={() => onSuggested(item)}
                    className="action-button flex w-full items-center justify-between rounded-xl border border-border p-3 text-left text-xs font-semibold text-brand-navy hover:border-brand-teal"
                  >
                    <span>{item}</span>
                    <ChevronRight className="size-4 text-brand-teal" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <footer className="border-t border-border bg-white p-4">
          <div className="flex gap-2">
            <input
              aria-label="Ask Masaar"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onAsk();
              }}
              placeholder="Ask about cash, stock, delivery, customers…"
              className="min-h-12 flex-1 rounded-xl border border-border bg-surface-muted px-4 text-sm outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal-soft"
            />
            <Button
              aria-label="Send question"
              disabled={!question.trim() || asking}
              onClick={onAsk}
            >
              {asking ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function PredictiveLoading() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <Skeleton className="h-[365px] rounded-[30px]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Skeleton className="h-[430px]" />
        <Skeleton className="h-[430px]" />
      </div>
    </div>
  );
}
function ForecastBound({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-brand-navy/50 p-3">
      <span className="text-[9px] text-white/45">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}
function SignalCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  detail: string;
  tone: 'gold' | 'teal' | 'rose' | 'blue';
}) {
  const colors = {
    gold: 'bg-brand-gold-soft text-warning-strong',
    teal: 'bg-brand-teal-soft text-brand-teal-deep',
    rose: 'bg-danger-soft text-danger-strong',
    blue: 'bg-info-soft text-info-strong',
  };
  return (
    <Card className="metric-depth">
      <div className="flex items-start justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${colors[tone]}`}>
          <Icon className="size-5" />
        </span>
        <ArrowRight className="size-4 text-border" />
      </div>
      <p className="mt-4 text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-brand-navy">{value}</p>
      <p className="mt-1 text-[10px] text-ink-muted">{detail}</p>
    </Card>
  );
}
function RangeControl({
  label,
  value,
  min,
  max,
  onChange,
  prefix = '',
  suffix = '',
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-muted">{label}</span>
        <strong className="text-brand-navy">
          {prefix}
          {value.toLocaleString()}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-brand-teal"
      />
    </label>
  );
}
function ScenarioTile({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${warning ? 'bg-danger-soft' : 'bg-surface-muted'}`}>
      <span className="text-[10px] text-ink-muted">{label}</span>
      <strong
        className={`mt-1 block font-display text-lg ${warning ? 'text-danger-strong' : 'text-brand-navy'}`}
      >
        {value}
      </strong>
    </div>
  );
}
function RiskBadge({ band }: { band: PredictiveSnapshot['deliveryRisks'][number]['band'] }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-bold ${band === 'HIGH' ? 'bg-danger-soft text-danger-strong' : band === 'MEDIUM' ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}`}
    >
      {band}
    </span>
  );
}
function ReliabilityBadge({
  indicator,
}: {
  indicator: PredictiveSnapshot['customerReliability'][number]['indicator'];
}) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-bold ${indicator === 'EXTRA_CONFIRMATION' ? 'bg-danger-soft text-danger-strong' : indicator === 'CAUTION' ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'}`}
    >
      {indicator.replaceAll('_', ' ')}
    </span>
  );
}
function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | number[] }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const expected = payload.find((item) => item.name === 'expected')?.value;
  const range = payload.find((item) => item.name === 'range')?.value;
  return (
    <div className="rounded-xl border border-white/10 bg-brand-navy/95 p-3 text-white shadow-2xl">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">{label}</p>
      {typeof expected === 'number' && (
        <p className="mt-2 text-xs">
          <span className="text-white/50">Expected</span>{' '}
          <strong className="float-right ml-5">${expected.toFixed(2)}</strong>
        </p>
      )}
      {Array.isArray(range) && (
        <p className="mt-1 text-xs">
          <span className="text-white/50">Range</span>{' '}
          <strong className="float-right ml-5">
            ${range[0]?.toFixed(2)}–${range[1]?.toFixed(2)}
          </strong>
        </p>
      )}
    </div>
  );
}
