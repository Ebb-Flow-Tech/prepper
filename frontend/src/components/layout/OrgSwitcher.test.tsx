import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrgSwitcher } from './OrgSwitcher';

/**
 * The org switcher decides what every page shows, and two things about it are invisible to
 * `next build`:
 *
 *  - it reconciles a PERSISTED selection against the server's list, so a revoked membership must
 *    not leave a stale org id being sent as `X-Organization-Id` (the backend 403s it);
 *  - changing org must clear the whole query cache, because every cached key is org-dependent and
 *    anything less renders one org's data under another's name.
 *
 * Neither is type-checkable. This is the only frontend logic in this change worth a unit test.
 */

const mockSetActiveOrgId = vi.fn();
let mockActiveOrgId: string | null = null;
let mockOrgs: Array<{ id: string; name: string; slug: string; status: string; my_org_role: string }> = [];
let mockLoading = false;

vi.mock('@/lib/store', () => ({
  useAppState: () => ({
    activeOrgId: mockActiveOrgId,
    setActiveOrgId: mockSetActiveOrgId,
  }),
}));

vi.mock('@/lib/hooks', () => ({
  useOrganizations: () => ({ data: mockOrgs, isLoading: mockLoading }),
}));

function org(id: string, name: string, role = 'Member') {
  return { id, name, slug: name.toLowerCase(), status: 'active', my_org_role: role };
}

beforeEach(() => {
  mockSetActiveOrgId.mockClear();
  mockActiveOrgId = null;
  mockOrgs = [];
  mockLoading = false;
});

describe('OrgSwitcher', () => {
  it('renders the org name as static text when there is only one org', () => {
    mockOrgs = [org('org-a', 'Mission Groups', 'Admin')];
    mockActiveOrgId = 'org-a';

    render(<OrgSwitcher />);

    expect(screen.getByText('Mission Groups')).toBeInTheDocument();
    // A dropdown that cannot drop is a lie about the shape of the product.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders a picker when the user belongs to several orgs', () => {
    mockOrgs = [org('org-a', 'Mission Groups'), org('org-b', 'Second Org')];
    mockActiveOrgId = 'org-a';

    render(<OrgSwitcher />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Second Org' })).toBeInTheDocument();
  });

  it('auto-selects the only org so a single-org user never thinks about it', () => {
    mockOrgs = [org('org-a', 'Mission Groups')];
    mockActiveOrgId = null;

    render(<OrgSwitcher />);

    expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-a');
  });

  it('falls back when the persisted org is no longer one of yours', () => {
    // The membership was revoked while the selection sat in localStorage. Sending it would 403
    // every request; the switcher must self-correct rather than strand the session.
    mockOrgs = [org('org-a', 'Mission Groups')];
    mockActiveOrgId = 'org-REVOKED';

    render(<OrgSwitcher />);

    expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-a');
  });

  it('leaves a still-valid selection alone', () => {
    mockOrgs = [org('org-a', 'A'), org('org-b', 'B')];
    mockActiveOrgId = 'org-b';

    render(<OrgSwitcher />);

    expect(mockSetActiveOrgId).not.toHaveBeenCalled();
  });

  it('switches org on selection', async () => {
    mockOrgs = [org('org-a', 'A'), org('org-b', 'B')];
    mockActiveOrgId = 'org-a';

    render(<OrgSwitcher />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'org-b');

    expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-b');
  });

  it('renders nothing while loading or with no orgs', () => {
    mockLoading = true;
    const { container, rerender } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();

    mockLoading = false;
    mockOrgs = [];
    rerender(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
    // No orgs is not a selection worth making — and must not spuriously set one.
    expect(mockSetActiveOrgId).not.toHaveBeenCalled();
  });
});
