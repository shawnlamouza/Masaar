import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: 'action-button-primary bg-brand-teal text-white hover:bg-brand-teal-deep shadow-sm',
    secondary:
      'action-button-secondary border border-border bg-surface text-ink hover:border-brand-teal/45 hover:bg-surface-muted',
    ghost: 'action-button-ghost text-ink-muted hover:bg-surface-muted hover:text-ink',
  };
  return (
    <button
      className={`action-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`surface-card rounded-2xl border border-border bg-surface p-5 shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusBadge({
  tone,
  children,
}: PropsWithChildren<{ tone: 'success' | 'warning' | 'danger' | 'info' }>) {
  const tones = {
    success: 'bg-success-soft text-success-strong',
    warning: 'bg-warning-soft text-warning-strong',
    danger: 'bg-danger-soft text-danger-strong',
    info: 'bg-info-soft text-info-strong',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
      <div className="mb-4 rounded-2xl bg-brand-teal-soft p-3 text-brand-teal-deep">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{detail}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />
  );
}
