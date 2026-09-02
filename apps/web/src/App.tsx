import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Notification, Role } from '@masaar/contracts';
import { Button, Card, Skeleton, StatusBadge } from '@masaar/ui';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BadgeDollarSign,
  Bell,
  Box,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  LogOut,
  Menu,
  PackageCheck,
  PackageSearch,
  Route,
  Search,
  Settings2,
  Sparkles,
  Truck,
  Users,
  WalletCards,
  Warehouse,
  RotateCcw,
  X,
  Zap,
  BrainCircuit,
  Command,
  Compass,
  Rocket,
} from 'lucide-react';
import {
  getCommerceSnapshot,
  getFulfillmentSnapshot,
  getNotifications,
  listOrders,
  markNotificationRead,
  setApiAuth,
  type AuthSession,
} from './api';
import { ComponentGallery } from './ComponentGallery';
import { CommerceWorkspace, type CommerceView } from './CommerceWorkspace';
import { CustomerConfirmationPage } from './CustomerConfirmationPage';
import { OrdersWorkspace } from './OrdersWorkspace';
import { SignInPage } from './SignInPage';
import { FulfillmentWorkspace } from './FulfillmentWorkspace';
import { BusinessSetupWorkspace } from './BusinessSetupWorkspace';
import { InventoryWorkspace, type InventoryView } from './InventoryWorkspace';

const BusinessIntelligenceWorkspace = lazy(() =>
  import('./BusinessIntelligenceWorkspace').then((module) => ({
    default: module.BusinessIntelligenceWorkspace,
  })),
);
const PredictiveWorkspace = lazy(() =>
  import('./PredictiveWorkspace').then((module) => ({ default: module.PredictiveWorkspace })),
);
const LaunchCenterWorkspace = lazy(() =>
  import('./LaunchCenterWorkspace').then((module) => ({ default: module.LaunchCenterWorkspace })),
);

const NAV = [
  {
    label: 'Overview',
    section: 'Today',
    keywords: 'home action center brief',
    icon: BarChart3,
    color: 'text-brand-gold',
  },
  {
    label: 'Intelligence',
    section: 'Today',
    keywords: 'analytics profit cash charts decisions',
    icon: BrainCircuit,
    color: 'text-brand-teal',
  },
  {
    label: 'Forecast & AI',
    section: 'Today',
    keywords: 'forecast anomalies assistant risk',
    icon: Sparkles,
    color: 'text-brand-gold',
  },
  {
    label: 'Orders',
    section: 'Operate',
    keywords: 'quick order kanban customer confirmation',
    icon: ClipboardList,
    color: 'text-brand-teal',
  },
  {
    label: 'Catalog',
    section: 'Operate',
    keywords: 'products variants sku prices',
    icon: PackageSearch,
    color: 'text-[#8cd3ff]',
  },
  {
    label: 'Customers',
    section: 'Operate',
    keywords: 'profiles addresses reliability history',
    icon: Users,
    color: 'text-[#f3a6ff]',
  },
  {
    label: 'Delivery',
    section: 'Fulfill',
    keywords: 'drivers companies zones dispatch route',
    icon: Truck,
    color: 'text-[#86c7ff]',
  },
  {
    label: 'Payments',
    section: 'Fulfill',
    keywords: 'cash whish omt custody reconciliation',
    icon: WalletCards,
    color: 'text-[#ffd58a]',
  },
  {
    label: 'Stock Control',
    section: 'Fulfill',
    keywords: 'inventory receipt movement low stock',
    icon: Warehouse,
    color: 'text-[#84f2c4]',
  },
  {
    label: 'Returns',
    section: 'Fulfill',
    keywords: 'refund exchange replacement',
    icon: RotateCcw,
    color: 'text-[#ffadad]',
  },
  {
    label: 'Suppliers',
    section: 'Control',
    keywords: 'supplier lead time cost',
    icon: Building2,
    color: 'text-[#ffb487]',
  },
  {
    label: 'Price Studio',
    section: 'Control',
    keywords: 'currency fx margin pricing',
    icon: BadgeDollarSign,
    color: 'text-brand-gold',
  },
  {
    label: 'Launch Center',
    section: 'Business',
    keywords: 'launch lebanon admin integrations growth pwa',
    icon: Rocket,
    color: 'text-brand-gold',
  },
  {
    label: 'Business setup',
    section: 'Business',
    keywords: 'company team employees roles zones resources',
    icon: Settings2,
    color: 'text-brand-teal',
  },
] as const;
type AppView = (typeof NAV)[number]['label'];
type NavItem = (typeof NAV)[number];
const COMMERCE_VIEWS: CommerceView[] = ['Catalog', 'Customers', 'Suppliers', 'Price Studio'];
const INVENTORY_VIEWS: InventoryView[] = ['Stock Control', 'Returns'];
const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  DRIVER: 'Driver',
  READ_ONLY: 'Analyst',
};

export function App() {
  const path = window.location.pathname;
  if (path === '/foundation/components') return <ComponentGallery />;
  if (path.startsWith('/confirm/'))
    return <CustomerConfirmationPage token={decodeURIComponent(path.slice('/confirm/'.length))} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [auth, setAuth] = useState<AuthSession | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('masaar.auth') ?? 'null') as AuthSession | null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    setApiAuth(auth);
    if (auth) sessionStorage.setItem('masaar.auth', JSON.stringify(auth));
    else sessionStorage.removeItem('masaar.auth');
  }, [auth]);
  useEffect(() => {
    const handleExpiredSession = () => setAuth(null);
    window.addEventListener('masaar:auth-expired', handleExpiredSession);
    return () => window.removeEventListener('masaar:auth-expired', handleExpiredSession);
  }, []);
  if (!auth) return <SignInPage onSignedIn={setAuth} />;
  return <AppShell auth={auth} onSignOut={() => setAuth(null)} />;
}

function AppShell({ auth, onSignOut }: { auth: AuthSession; onSignOut: () => void }) {
  const role = auth.session.role;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [activeView, setActiveView] = useState<AppView>(
    auth.session.onboardingRequired
      ? 'Business setup'
      : role === 'DRIVER'
        ? 'Delivery'
        : 'Overview',
  );
  useEffect(() => {
    let live = true;
    let refreshTimer = 0;
    const loadNotifications = () => {
      getNotifications(role)
        .then((value) => {
          if (!live) return;
          setNotifications(value);
          setOnline(true);
        })
        .catch(() => live && setOnline(false));
    };
    const refreshAfterMutation = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadNotifications, 80);
    };
    loadNotifications();
    window.addEventListener('masaar:data-changed', refreshAfterMutation);
    return () => {
      live = false;
      window.clearTimeout(refreshTimer);
      window.removeEventListener('masaar:data-changed', refreshAfterMutation);
    };
  }, [role]);
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener('keydown', handleKeyboard);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
    return () => {
      window.removeEventListener('keydown', handleKeyboard);
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);
  const filteredNav = useMemo(() => {
    if (role === 'DRIVER') return NAV.filter((item) => item.label === 'Delivery');
    if (role === 'EMPLOYEE')
      return NAV.filter((item) =>
        [
          'Overview',
          'Orders',
          'Catalog',
          'Customers',
          'Delivery',
          'Payments',
          'Stock Control',
          'Returns',
        ].includes(item.label),
      );
    if (role === 'READ_ONLY')
      return NAV.filter((item) =>
        [
          'Overview',
          'Intelligence',
          'Forecast & AI',
          'Orders',
          'Catalog',
          'Customers',
          'Delivery',
          'Payments',
          'Stock Control',
          'Returns',
          'Launch Center',
        ].includes(item.label),
      );
    return NAV;
  }, [role]);
  const unread = notifications.filter((item) => !item.read).length;
  const mobileNav = useMemo(() => {
    const preferred =
      role === 'DRIVER'
        ? ['Delivery']
        : role === 'EMPLOYEE'
          ? ['Overview', 'Orders', 'Delivery', 'Stock Control']
          : ['Overview', 'Orders', 'Intelligence', 'Launch Center'];
    return preferred
      .map((label) => filteredNav.find((item) => item.label === label))
      .filter((item): item is NavItem => Boolean(item));
  }, [filteredNav, role]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeView]);

  async function openNotification(notification: Notification) {
    await markNotificationRead(role, notification.id);
    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    setActiveView(notification.target);
    setNotificationsOpen(false);
  }

  return (
    <div className="min-h-screen bg-surface-muted lg:grid lg:grid-cols-[276px_1fr]">
      <aside className="tech-grid sticky top-0 hidden h-screen overflow-y-auto bg-brand-navy p-5 text-white lg:flex lg:flex-col">
        <Brand />
        <div className="mt-7 rounded-2xl border border-white/10 bg-white/6 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
            Signed in as
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-teal font-display font-bold text-brand-navy">
              {auth.session.displayName.charAt(0)}
            </span>
            <div>
              <p className="text-sm font-bold">{auth.session.displayName}</p>
              <p className="text-[11px] text-brand-teal">{ROLE_LABELS[role]} workspace</p>
            </div>
          </div>
        </div>
        <nav aria-label="Primary" className="mt-5 flex-1 space-y-0.5">
          {filteredNav.map(({ label, icon: Icon, color, section }, index) => (
            <div key={label}>
              {(index === 0 || filteredNav[index - 1]?.section !== section) && (
                <p
                  className={`${index ? 'mt-4' : ''} mb-1 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-white/30`}
                >
                  {section}
                </p>
              )}
              <button
                onClick={() => {
                  setActiveView(label);
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition duration-150 ${activeView === label ? 'translate-x-1 bg-white text-brand-navy shadow-[inset_0_1px_0_white,0_7px_0_-4px_rgba(0,168,156,.45),0_14px_28px_rgba(0,0,0,.18)]' : 'text-white/65 hover:translate-x-1 hover:bg-white/8 hover:text-white'}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-lg ${activeView === label ? 'bg-brand-navy' : 'bg-white/6'} ${color}`}
                >
                  <Icon className="size-3.5" />
                </span>
                {label}
                {label === 'Orders' && (
                  <span className="ml-auto rounded-full bg-brand-teal px-2 py-0.5 text-[9px] text-white">
                    Live
                  </span>
                )}
                {label === 'Launch Center' && (
                  <span className="ml-auto rounded-full bg-brand-gold px-2 py-0.5 text-[9px] text-brand-navy">
                    Final
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="relative mt-5 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-teal/12 to-brand-gold/8">
          <div className="absolute -right-7 -top-8 size-24 rounded-full bg-brand-teal/15 blur-2xl" />
          <div className="relative p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-gold">
              <Zap className="size-4" /> Launch-ready build
            </p>
            <p className="mt-2 text-xs leading-5 text-white/60">
              Launch controls, local administration and governed growth now complete the system.
            </p>
          </div>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-white/88 px-4 py-3 backdrop-blur-xl md:px-7">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <button
              aria-label="Open navigation"
              className="rounded-xl p-2 text-ink lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <button
              aria-label="Open command search"
              onClick={() => setCommandOpen(true)}
              className="clickable-surface relative ml-auto hidden min-h-11 max-w-md flex-1 items-center rounded-xl border border-border bg-surface-muted pl-10 pr-3 text-left text-sm text-ink-muted hover:border-brand-teal/45 hover:bg-white md:flex"
            >
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-teal-deep" />
              Find any tool or search orders…
              <kbd className="ml-auto hidden rounded-lg border border-border bg-white px-2 py-1 font-sans text-[10px] font-bold text-ink-muted xl:block">
                Ctrl K
              </kbd>
            </button>
            {role !== 'DRIVER' && (
              <div className="relative ml-auto md:ml-0">
                <button
                  aria-label="Notifications"
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setProfileOpen(false);
                  }}
                  className="clickable-surface relative grid size-11 place-items-center rounded-xl border border-border bg-white text-brand-navy shadow-sm"
                >
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-13 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border p-4">
                      <div>
                        <p className="font-display text-lg font-bold text-brand-navy">
                          Needs attention
                        </p>
                        <p className="text-xs text-ink-muted">
                          Live operational warnings, not marketing alerts.
                        </p>
                      </div>
                      <StatusBadge tone={unread ? 'warning' : 'success'}>
                        {unread} unread
                      </StatusBadge>
                    </div>
                    <div className="max-h-[420px] overflow-auto p-2">
                      {notifications.length ? (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => void openNotification(notification)}
                            className={`w-full rounded-xl p-3 text-left transition hover:bg-surface-muted ${notification.read ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 size-2 shrink-0 rounded-full ${notification.severity === 'critical' ? 'bg-danger-strong' : notification.severity === 'warning' ? 'bg-brand-gold' : 'bg-brand-teal'}`}
                              />
                              <span>
                                <strong className="block text-sm text-brand-navy">
                                  {notification.title}
                                </strong>
                                <span className="mt-1 block text-xs leading-5 text-ink-muted">
                                  {notification.detail}
                                </span>
                                <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-brand-teal-deep">
                                  Open {notification.target}
                                </span>
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="p-6 text-center text-sm text-ink-muted">
                          Nothing needs attention right now.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="relative ml-auto md:ml-0">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                className="clickable-surface flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-left shadow-sm"
              >
                <span className="grid size-7 place-items-center rounded-lg bg-brand-navy text-xs font-bold text-brand-teal">
                  {auth.session.displayName.charAt(0)}
                </span>
                <span className="hidden sm:block">
                  <strong className="block text-xs text-brand-navy">
                    {auth.session.displayName}
                  </strong>
                  <span className="block text-[10px] text-ink-muted">{ROLE_LABELS[role]}</span>
                </span>
                <ChevronDown className="size-4 text-ink-muted" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-13 z-40 w-60 rounded-2xl border border-border bg-white p-2 shadow-xl">
                  <div className="p-3">
                    <p className="text-sm font-bold text-brand-navy">{auth.session.displayName}</p>
                    <p className="text-xs text-ink-muted">Role controls tools and actions</p>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-danger-strong hover:bg-danger-soft"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-xs font-semibold text-warning-strong"
          >
            <AlertTriangle className="size-4" /> API connection lost. Changes are paused so Masaar
            never pretends they were saved.
          </div>
        )}
        <div className="masaar-grid min-h-[calc(100vh-68px)] px-4 pb-24 pt-6 md:px-7 lg:py-8">
          {activeView === 'Orders' ? (
            <OrdersWorkspace role={role} initialSearch={orderSearch} />
          ) : activeView === 'Delivery' || activeView === 'Payments' ? (
            <FulfillmentWorkspace
              role={role}
              mode={activeView === 'Payments' ? 'Money' : 'Delivery'}
            />
          ) : activeView === 'Business setup' ? (
            <BusinessSetupWorkspace role={role} onOpenCatalog={() => setActiveView('Catalog')} />
          ) : INVENTORY_VIEWS.includes(activeView as InventoryView) ? (
            <InventoryWorkspace view={activeView as InventoryView} role={role} />
          ) : COMMERCE_VIEWS.includes(activeView as CommerceView) ? (
            <CommerceWorkspace view={activeView as CommerceView} role={role} />
          ) : activeView === 'Overview' ? (
            <Overview
              auth={auth}
              notifications={notifications}
              onOpenOrders={() => setActiveView('Orders')}
              onOpenView={setActiveView}
            />
          ) : activeView === 'Intelligence' ? (
            <Suspense
              fallback={
                <div className="mx-auto max-w-[1500px]">
                  <Skeleton className="h-[345px] rounded-[30px]" />
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Skeleton key={index} className="h-44" />
                    ))}
                  </div>
                </div>
              }
            >
              <BusinessIntelligenceWorkspace
                role={role}
                onOpenView={(view) => setActiveView(view)}
              />
            </Suspense>
          ) : activeView === 'Forecast & AI' ? (
            <Suspense
              fallback={
                <div className="mx-auto max-w-[1500px]">
                  <Skeleton className="h-[365px] rounded-[30px]" />
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-36" />
                    ))}
                  </div>
                </div>
              }
            >
              <PredictiveWorkspace role={role} onOpenView={(view) => setActiveView(view)} />
            </Suspense>
          ) : activeView === 'Launch Center' ? (
            <Suspense
              fallback={
                <div className="mx-auto max-w-[1500px]">
                  <Skeleton className="h-[350px] rounded-[30px]" />
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Skeleton key={index} className="h-44" />
                    ))}
                  </div>
                </div>
              }
            >
              <LaunchCenterWorkspace role={role} onOpenView={(view) => setActiveView(view)} />
            </Suspense>
          ) : (
            <ComingSoon view={activeView} />
          )}
        </div>
      </main>
      {role !== 'DRIVER' && (
        <nav
          aria-label="Mobile shortcuts"
          className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-white/60 bg-brand-navy/95 p-1.5 text-white shadow-2xl backdrop-blur-xl lg:hidden"
        >
          {mobileNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveView(label)}
              className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-bold ${activeView === label ? 'bg-white text-brand-navy' : 'text-white/55'}`}
            >
              <Icon className={`size-4 ${activeView === label ? 'text-brand-teal-deep' : ''}`} />
              <span className="max-w-full truncate">
                {label === 'Launch Center'
                  ? 'Launch'
                  : label === 'Overview'
                    ? 'Home'
                    : label === 'Intelligence'
                      ? 'BI'
                      : label}
              </span>
            </button>
          ))}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-bold text-white/55"
          >
            <Compass className="size-4" /> More
          </button>
        </nav>
      )}
      {commandOpen && (
        <CommandPalette
          items={filteredNav}
          query={searchInput}
          onQuery={setSearchInput}
          onClose={() => setCommandOpen(false)}
          onSelect={(view) => {
            setActiveView(view);
            setCommandOpen(false);
            setSearchInput('');
          }}
          onSearchOrders={(query) => {
            setOrderSearch(query);
            setActiveView('Orders');
            setCommandOpen(false);
            setSearchInput('');
          }}
        />
      )}
      {menuOpen && (
        <div className="tech-grid fixed inset-0 z-50 overflow-y-auto bg-brand-navy p-5 pb-10 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <button
              aria-label="Close navigation"
              className="rounded-lg p-2"
              onClick={() => setMenuOpen(false)}
            >
              <X />
            </button>
          </div>
          <nav className="mt-7 grid gap-2 sm:grid-cols-2">
            {filteredNav.map(({ label, icon: Icon, color, section }, index) => (
              <div key={label} className="contents">
                {(index === 0 || filteredNav[index - 1]?.section !== section) && (
                  <p className="mt-4 px-1 text-[9px] font-bold uppercase tracking-[.2em] text-white/35 sm:col-span-2">
                    {section}
                  </p>
                )}
                <button
                  onClick={() => {
                    setActiveView(label);
                    setMenuOpen(false);
                    setNotificationsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left font-semibold ${activeView === label ? 'border-brand-teal/30 bg-white text-brand-navy' : 'border-white/5 bg-white/5 text-white/80'}`}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-navy-soft">
                    <Icon className={`size-5 ${color}`} />
                  </span>
                  {label}
                </button>
              </div>
            ))}
          </nav>
          <Button
            variant="secondary"
            className="mt-8 w-full border-white/20 bg-white/8 text-white"
            onClick={onSignOut}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({
  items,
  query,
  onQuery,
  onClose,
  onSelect,
  onSearchOrders,
}: {
  items: readonly NavItem[];
  query: string;
  onQuery: (value: string) => void;
  onClose: () => void;
  onSelect: (view: AppView) => void;
  onSearchOrders: (query: string) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const matches = items.filter((item) =>
    `${item.label} ${item.section} ${item.keywords}`.toLowerCase().includes(normalized),
  );
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-brand-navy/72 px-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find tools and orders"
        className="w-full max-w-2xl overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-2xl"
      >
        <div className="relative border-b border-border p-4">
          <Command className="absolute left-7 top-1/2 size-5 -translate-y-1/2 text-brand-teal-deep" />
          <input
            autoFocus
            aria-label="Search commands"
            placeholder="Try “cash”, “driver”, “customer”, or an order number…"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && normalized) onSearchOrders(query.trim());
            }}
            className="min-h-12 w-full border-0 bg-transparent pl-11 pr-12 text-base font-semibold text-brand-navy outline-none placeholder:font-normal placeholder:text-ink-muted"
          />
          <button
            aria-label="Close search"
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-brand-gold">
            Masaar tools
          </p>
          {matches.length ? (
            matches.map(({ label, section, icon: Icon, color }) => (
              <button
                key={label}
                onClick={() => onSelect(label)}
                className="group flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-surface-muted"
              >
                <span
                  className={`grid size-10 place-items-center rounded-xl bg-brand-navy ${color}`}
                >
                  <Icon className="size-5" />
                </span>
                <span>
                  <strong className="block text-sm text-brand-navy">{label}</strong>
                  <span className="text-xs text-ink-muted">{section}</span>
                </span>
                <ArrowUpRight className="ml-auto size-4 text-ink-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            ))
          ) : (
            <p className="rounded-xl bg-surface-muted p-4 text-sm text-ink-muted">
              No tool matches “{query}”. You can still search the order ledger below.
            </p>
          )}
          {normalized && items.some((item) => item.label === 'Orders') && (
            <button
              onClick={() => onSearchOrders(query.trim())}
              className="mt-2 flex w-full items-center gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal-soft p-3 text-left hover:border-brand-teal/45"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-teal text-white">
                <Search className="size-5" />
              </span>
              <span>
                <strong className="block text-sm text-brand-navy">Search order records</strong>
                <span className="text-xs text-ink-muted">
                  Order number, customer, phone, SKU or product
                </span>
              </span>
              <span className="ml-auto text-xs font-bold text-brand-teal-deep">Enter</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-muted px-5 py-3 text-[10px] font-semibold text-ink-muted">
          <span>Role-scoped results only</span>
          <span>Esc to close · Enter searches orders</span>
        </div>
      </div>
    </div>
  );
}

function Overview({
  auth,
  notifications,
  onOpenOrders,
  onOpenView,
}: {
  auth: AuthSession;
  notifications: Notification[];
  onOpenOrders: () => void;
  onOpenView: (view: AppView) => void;
}) {
  const [summary, setSummary] = useState<{
    collected: string;
    cashHeld: string;
    activeOrders: number;
    deliverySuccess: string;
    products: number;
    customers: number;
  } | null>(null);
  useEffect(() => {
    Promise.all([
      listOrders(auth.session.role),
      getCommerceSnapshot(auth.session.role),
      getFulfillmentSnapshot(auth.session.role),
    ]).then(([orders, commerce, fulfillment]) => {
      const usdCollected = fulfillment.dailyClose.collectionsByMethod
        .filter((item) => item.amount.currency === 'USD')
        .reduce((sum, item) => sum + item.amount.amountMinor, 0);
      const cashHeld = fulfillment.cashPositions
        .filter((item) => item.currency === 'USD' && item.holderId !== 'business_cash')
        .reduce((sum, item) => sum + item.amount.amountMinor, 0);
      const closed = ['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'];
      const completed = fulfillment.deliveries.filter((item) => item.status === 'COMPLETED').length;
      const failed = fulfillment.deliveries.filter((item) => item.status === 'FAILED').length;
      setSummary({
        collected: `$${(usdCollected / 100).toFixed(2)}`,
        cashHeld: `$${(cashHeld / 100).toFixed(2)}`,
        activeOrders: orders.filter((order) => !closed.includes(order.status)).length,
        deliverySuccess:
          completed + failed ? `${Math.round((completed / (completed + failed)) * 100)}%` : '—',
        products: commerce.products.length,
        customers: commerce.customers.length,
      });
    });
  }, [auth.session.role]);
  const employee = auth.session.role === 'EMPLOYEE';
  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="overview-stage depth-stage relative overflow-hidden rounded-[30px] bg-brand-navy text-white">
        <img
          src="/brand/masaar-banner-dark.png"
          alt="Masaar operations and insights"
          className="absolute inset-0 hidden h-full w-full object-cover opacity-30 md:block"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/88 to-brand-navy/30" />
        <div className="relative z-10 grid min-h-[360px] items-center gap-8 p-7 md:p-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">
              <Sparkles className="size-4" />{' '}
              {employee ? 'Your live work queue' : 'Live operating brief'}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-[-.04em] md:text-5xl">
              {employee
                ? `Ready, ${auth.session.displayName.split(' ')[0]}?`
                : `Good morning, ${auth.session.displayName.split(' ')[0]}.`}
              <br />
              <span className="text-brand-teal">
                {employee ? 'Handle what needs action.' : 'See what is actually happening.'}
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">
              {employee
                ? 'Start with the warnings below, capture new orders, and move assigned work forward. Owner-only controls stay out of your way.'
                : 'Every number below comes from orders, delivery attempts and payments already recorded in Masaar.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={onOpenOrders}
                className="gold-action border border-white/15 text-brand-navy"
              >
                <ClipboardList className="size-4" /> Create an order
              </Button>
              <Button
                variant="secondary"
                className="border-white/20 bg-white/8 text-white hover:bg-white/15"
                onClick={() => onOpenView(employee ? 'Delivery' : 'Intelligence')}
              >
                {employee ? 'Open delivery queue' : 'Open Business Intelligence'}{' '}
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="hidden justify-end lg:flex">
            <img
              src="/brand/masaar-poster-light.jpg"
              alt="Masaar Lebanese business dashboard poster"
              className="brand-glow h-72 w-44 rotate-2 rounded-3xl object-cover object-top"
            />
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CircleDollarSign}
          label="Collected today"
          value={summary?.collected ?? '—'}
          detail="Posted payment entries"
        />
        <Metric
          icon={WalletCards}
          label="Cash currently held"
          value={summary?.cashHeld ?? '—'}
          detail="Outside the business register"
          warning={Boolean(summary && summary.cashHeld !== '$0.00')}
        />
        <Metric
          icon={PackageCheck}
          label="Orders in progress"
          value={summary ? String(summary.activeOrders) : '—'}
          detail={`${notifications.filter((item) => !item.read).length} warning(s) need attention`}
        />
        <Metric
          icon={Route}
          label="Delivery success"
          value={summary?.deliverySuccess ?? '—'}
          detail="Completed vs failed cases"
        />
      </section>
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
              Action center
            </p>
            <h2 className="font-display text-2xl font-bold text-brand-navy">
              Act before it costs you
            </h2>
          </div>
          {notifications.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {notifications.slice(0, 4).map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onOpen={() => onOpenView(notification.target)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          )}
        </div>
        <Card className="overflow-hidden border-0 bg-brand-navy text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal">
            Tools that work together
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            One operational path, not disconnected screens.
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(employee
              ? [
                  `Products · ${summary?.products ?? '—'}`,
                  `Customers · ${summary?.customers ?? '—'}`,
                  'Orders',
                  'Catalog',
                  'Delivery',
                  'Payments',
                  'Stock Control',
                  'Returns',
                ]
              : [
                  `Products · ${summary?.products ?? '—'}`,
                  `Customers · ${summary?.customers ?? '—'}`,
                  'Orders',
                  'Payments',
                  'Delivery',
                  'Business setup',
                  'Stock Control',
                  'Returns',
                ]
            ).map((tool, index) => (
              <div key={tool} className="rounded-xl border border-white/10 bg-white/6 p-3">
                <span className="text-[10px] font-bold text-brand-gold">0{index + 1}</span>
                <p className="mt-1 text-sm font-bold">{tool}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: typeof Box;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card className="metric-depth transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between">
        <div
          className={`rounded-xl p-2.5 ${warning ? 'bg-warning-soft text-warning-strong' : 'bg-brand-teal-soft text-brand-teal-deep'}`}
        >
          <Icon className="size-5" />
        </div>
        {warning && <StatusBadge tone="warning">Review</StatusBadge>}
      </div>
      <p className="mt-4 text-sm font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-brand-navy">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </Card>
  );
}
function NotificationCard({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const tone =
    notification.severity === 'critical'
      ? 'danger'
      : notification.severity === 'warning'
        ? 'warning'
        : notification.severity === 'success'
          ? 'success'
          : 'info';
  return (
    <Card className="group transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <StatusBadge tone={tone}>{notification.severity}</StatusBadge>
        {!notification.read && <span className="text-xs font-bold text-brand-gold">Unread</span>}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-brand-navy">{notification.title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{notification.detail}</p>
      <Button variant="ghost" className="mt-3 px-0 text-brand-teal-deep" onClick={onOpen}>
        Open {notification.target}
        <ArrowUpRight className="size-4" />
      </Button>
    </Card>
  );
}
function ComingSoon({ view }: { view: AppView }) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card className="relative overflow-hidden p-8 md:p-12">
        <div className="absolute right-0 top-0 size-48 rounded-full bg-brand-teal-soft blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-gold">
            Connected module
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-brand-navy">{view}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            This tool is visible because it belongs in Masaar’s end-to-end path. Its functional
            workflow arrives in the dedicated project phase, using the order and commerce data
            already in place.
          </p>
        </div>
      </Card>
    </div>
  );
}
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/brand/masaar-logo-dark.png"
        alt="Masaar"
        className={`${compact ? 'size-9' : 'size-12'} rounded-xl object-cover shadow-lg`}
      />
      <div>
        <div
          className={`${compact ? 'text-base text-brand-navy' : 'text-xl text-white'} font-display font-bold tracking-wide`}
        >
          Masaar
        </div>
        {!compact && (
          <div className="text-[9px] uppercase tracking-[.2em] text-brand-gold">
            Smart tools for Lebanon
          </div>
        )}
      </div>
    </div>
  );
}
