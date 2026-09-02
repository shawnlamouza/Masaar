import { AlertTriangle, Check, Inbox } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '@masaar/ui';

export function ComponentGallery() {
  return (
    <main className="min-h-screen bg-surface-muted px-4 py-10 text-ink md:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">
          Design system foundation
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold text-brand-navy">
          Masaar component gallery
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          A keyboard-friendly visual contract for the reusable controls that later commerce modules
          will use.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card>
            <h2 className="font-display text-xl font-bold text-brand-navy">Actions</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button>
                <Check className="size-4" />
                Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold text-brand-navy">Operational status</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge tone="success">Completed</StatusBadge>
              <StatusBadge tone="warning">Needs review</StatusBadge>
              <StatusBadge tone="danger">Failed</StatusBadge>
              <StatusBadge tone="info">In progress</StatusBadge>
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold text-brand-navy">Form controls</h2>
            <label className="mt-5 block text-sm font-semibold" htmlFor="gallery-input">
              Business name
            </label>
            <input
              id="gallery-input"
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-3 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal-soft"
              placeholder="Cedar & Thread"
            />
            <div
              role="alert"
              className="mt-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning-strong"
            >
              <AlertTriangle className="size-5 shrink-0" />
              Explainable warning with a clear next action.
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold text-brand-navy">
              Loading and empty states
            </h2>
            <Skeleton className="mt-5 h-11" />
            <div className="mt-4">
              <EmptyState
                icon={<Inbox className="size-6" />}
                title="Nothing needs attention"
                detail="Masaar will surface a card here when the owner needs to act."
              />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
