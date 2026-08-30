import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpansionSnapshot } from '@masaar/contracts';
import { LaunchCenterWorkspace } from './LaunchCenterWorkspace';

const snapshot: ExpansionSnapshot = {
  generatedAt: '2026-08-24T10:00:00.000Z',
  releaseLabel: 'PHASE_9_RELEASE_CANDIDATE',
  readinessPercent: 75,
  checks: [
    { id: 'catalog', label: 'Structured catalog', detail: 'Two products ready.', complete: true, target: 'Catalog' },
    { id: 'identity', label: 'Production identity', detail: 'Cognito required.', complete: false, target: 'Business setup' },
  ],
  integrations: [
    {
      id: 'action-center', name: 'Masaar Action Center', category: 'MESSAGING', status: 'CONNECTED', officialOnly: true,
      summary: 'Live operational alerts.', fallback: 'Inspect the record.', nextStep: 'Review thresholds.',
    },
    {
      id: 'whatsapp', name: 'WhatsApp Business Platform', category: 'MESSAGING', status: 'MANUAL_FALLBACK', officialOnly: true,
      summary: 'Copy templates manually.', fallback: 'Audited copy action.', nextStep: 'Use the official API.',
    },
  ],
  adminTasks: [
    {
      id: 'task-1', tenantId: 'tenant_cedar_thread', title: 'Verify tax deadline', category: 'TAX', status: 'DUE_SOON', dueDate: '2026-09-01', responsibleName: 'Owner / accountant', notes: 'Confirm with an official source.', reminderDays: 7, createdAt: '2026-08-24T10:00:00.000Z', updatedAt: '2026-08-24T10:00:00.000Z', updatedBy: 'system',
    },
  ],
  segments: [
    { id: 'CHAMPIONS', label: 'Champions', description: 'Strong repeat customers.', recommendedAction: 'Thank them personally.', customerIds: ['c1'], customerNames: ['Jana Khoury'], count: 1, revenueUsdMinor: 28400 },
    { id: 'RECOVERY_WATCH', label: 'Delivery recovery', description: 'Delivery care needed.', recommendedAction: 'Confirm address.', customerIds: [], customerNames: [], count: 0, revenueUsdMinor: 0 },
  ],
  guardrails: {
    adminAdvice: 'REMINDERS_NOT_LEGAL_ADVICE',
    providers: 'OFFICIAL_APIS_ONLY',
    customerUse: 'SEGMENTS_NOT_BLACKLISTS',
    automation: 'HUMAN_APPROVAL_REQUIRED',
  },
};

const mocks = vi.hoisted(() => ({
  getExpansionSnapshot: vi.fn(),
  createAdminTask: vi.fn(),
  updateAdminTask: vi.fn(),
}));
vi.mock('./api', () => mocks);

describe('Phase 9 Launch Center workspace', () => {
  beforeEach(() => {
    mocks.getExpansionSnapshot.mockResolvedValue(snapshot);
    mocks.createAdminTask.mockResolvedValue(snapshot.adminTasks[0]);
    mocks.updateAdminTask.mockResolvedValue(snapshot.adminTasks[0]);
  });
  afterEach(cleanup);

  it('makes release readiness and exact gaps visible', async () => {
    const onOpenView = vi.fn();
    render(<LaunchCenterWorkspace role="OWNER" onOpenView={onOpenView} />);
    expect(await screen.findByRole('heading', { name: /Launch with proof/i })).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Production identity/i }));
    expect(onOpenView).toHaveBeenCalledWith('Business setup');
  });

  it('exposes honest integration states, admin reminders and customer segments', async () => {
    render(<LaunchCenterWorkspace role="OWNER" onOpenView={vi.fn()} />);
    await screen.findByText('75%');
    fireEvent.click(screen.getByRole('button', { name: /Lebanon desk/i }));
    expect(screen.getByText('Verify tax deadline')).toBeInTheDocument();
    expect(screen.getByText(/does not interpret law/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Integrations$/i }));
    expect(screen.getByRole('button', { name: /WhatsApp Business Platform/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Customer growth/i }));
    expect(screen.getByText('Jana Khoury')).toBeInTheDocument();
    expect(screen.getByText(/never a blacklist/i)).toBeInTheDocument();
  });

  it('creates an owner reminder without requiring an artificial due date', async () => {
    render(<LaunchCenterWorkspace role="OWNER" onOpenView={vi.fn()} />);
    await screen.findByText('75%');
    fireEvent.click(screen.getByRole('button', { name: /Lebanon desk/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add reminder/i }));
    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: 'Verify document renewal requirement' },
    });
    fireEvent.change(screen.getByLabelText('What must be checked'), {
      target: { value: 'Confirm with the retained accountant or official source.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));
    await waitFor(() =>
      expect(mocks.createAdminTask).toHaveBeenCalledWith(
        'OWNER',
        expect.not.objectContaining({ dueDate: '' }),
      ),
    );
  });
});
