import { describe, it, expect, vi } from vitest;
import { render, screen, fireEvent } from @testing-library/react;
import @testing-library/jest-dom/vitest;
import React from react;
import AuditLogsPage from @/app/super-admin/audit-logs/page;
import { QueryClient, QueryClientProvider } from @tanstack/react-query;
import type { AuditLog } from @/types/audit;

const mockAuditLogs: AuditLog[] = [
  {
    id: log-1,
    community_id: comm-1,
    community_name: Green Park Enclave,
    community_code: GP-01,
    user_id: user-1,
    user_name: Ramesh Sharma,
    user_email: ramesh.sharma@example.com,
    role_slug: community_admin,
    module: onboarding,
    action: invitation.create,
    entity_type: resident_profile,
    entity_id: 376bea88-1234,
    created_at: 2026-09-17T10:36:00Z,
    ip_address: 192.168.1.100,
    user_agent: Mozilla/5.0 Chrome/120.0,
    new_values: { email: newresident@example.com, unit_id: unit-101 },
  },
  {
    id: log-2,
    community_id: null,
    community_name: null,
    community_code: null,
    user_id: null,
    user_name: null,
    user_email: null,
    role_slug: null,
    module: notifications,
    action: notification.dispatch,
    entity_type: notification,
    entity_id: 6d10db84-5678,
    created_at: 2026-09-17T10:40:00Z,
    ip_address: 127.0.0.1,
    user_agent: Celery Worker,
  },
];

vi.mock(@/hooks/use-audit, () => ({
  useAuditLogs: () => ({
    data: mockAuditLogs,
    isLoading: false,
  }),
}));

vi.mock(@/hooks/use-communities, () => ({
  useCommunities: () => ({
    data: [{ id: comm-1, name: Green Park Enclave, code: GP-01 }],
    isLoading: false,
  }),
}));

vi.mock(@/store/ui, () => ({
  useUiStore: () => ({
    activeCommunityId: null,
    setActiveCommunity: vi.fn(),
  }),
}));

vi.mock(@/lib/api, () => ({
  auditApi: {
    exportCsv: vi.fn().mockResolvedValue(created_at,community_id\n),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={testClient}>{ui}</QueryClientProvider>
  );
}

describe(Super Admin Audit Logs Page, () => {
  it(renders Community (Where) column correctly with community name and code, () => {
    renderWithClient(<AuditLogsPage />);

    expect(screen.getByText(Community (Where))).toBeInTheDocument();
    expect(screen.getByText(Green Park Enclave)).toBeInTheDocument();
    expect(screen.getByText(GP-01)).toBeInTheDocument();
    expect(screen.getByText(/Global \/ Platform/i)).toBeInTheDocument();
  });

  it(renders Actor (Who) column correctly with user full name, email, and role, () => {
    renderWithClient(<AuditLogsPage />);

    expect(screen.getByText(Actor (Who))).toBeInTheDocument();
    expect(screen.getByText(Ramesh Sharma)).toBeInTheDocument();
    expect(screen.getByText(ramesh.sharma@example.com)).toBeInTheDocument();
    expect(screen.getByText(community admin)).toBeInTheDocument();
    expect(screen.getByText(System)).toBeInTheDocument();
    expect(screen.getByText(Automated System Task)).toBeInTheDocument();
  });

  it(opens audit log detail inspection modal when Inspect button is clicked, () => {
    renderWithClient(<AuditLogsPage />);

    const inspectButtons = screen.getAllByRole(button, { name: /Inspect/i });
    expect(inspectButtons.length).toBe(2);

    fireEvent.click(inspectButtons[0]);

    expect(screen.getByText(/Audit Event Inspection/i)).toBeInTheDocument();
    expect(screen.getByText(192.168.1.100)).toBeInTheDocument();
    expect(screen.getByText(/newresident@example\.com/)).toBeInTheDocument();

    const closeBtn = screen.getByRole(button, { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/Audit Event Inspection/i)).not.toBeInTheDocument();
  });
});
