import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
import { RATE_LIMIT_MESSAGE } from './resolveLogin';
import { ApiError } from '@/lib/api';

const resolveLoginRoute = vi.fn();
const loginUser = vi.fn();
const push = vi.fn();

// `ApiError` and `API_BASE` stay real — `resolveLogin.ts` builds the start URL from one and
// discriminates the 429 with the other, and mocking either would test the mock.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    resolveLoginRoute: (email: string) => resolveLoginRoute(email),
    loginUser: (email: string, password: string) => loginUser(email, password),
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/lib/store', () => ({ useAppState: () => ({ login: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EMAIL = 'chef@example.com';

/** The password field does not exist on step 1 — it is not merely hidden. */
const passwordField = () => document.querySelector('#password');

describe('LoginPage — the two-step router', () => {
  beforeEach(() => {
    localStorage.clear();
    resolveLoginRoute.mockResolvedValue({ route: 'app-native' });
    loginUser.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('asks for an email only, with no password field and no sign-in choice', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(passwordField()).toBeNull();
    // No Google, no "SSO" button, no toggle: the address decides the route, so the user is never
    // asked which kind of account they hold.
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /sso|single sign|company account/i })).toBeNull();
  });

  it('reveals the password field in place once the server routes app-native', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(passwordField()).not.toBeNull());
    expect(resolveLoginRoute).toHaveBeenCalledWith(EMAIL);
    // Same screen: the email is still there, now read-only.
    expect(screen.getByLabelText(/email/i)).toHaveValue(EMAIL);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('"Use a different email" returns to step 1 and clears the password and the error', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(passwordField()).not.toBeNull());

    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use a different email/i }));

    expect(passwordField()).toBeNull();
    expect(screen.queryByText(/invalid credentials/i)).toBeNull();

    // Back on step 2, the old password must not still be sitting in state.
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(passwordField()).not.toBeNull());
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
  });

  it('does not carry a step-1 error onto step 2', async () => {
    const user = userEvent.setup();
    resolveLoginRoute.mockRejectedValueOnce(new ApiError(429, 'Too many attempts'));
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
    expect(passwordField()).toBeNull();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(passwordField()).not.toBeNull());
    expect(screen.queryByText(RATE_LIMIT_MESSAGE)).toBeNull();
  });
});
