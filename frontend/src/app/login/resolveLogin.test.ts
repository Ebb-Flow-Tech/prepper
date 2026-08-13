import { describe, expect, it, vi } from 'vitest';
import {
  PASSPORT_START_URL,
  RATE_LIMIT_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
  emailStepErrorMessage,
  submitEmailStep,
} from './resolveLogin';
import { ApiError } from '@/lib/api';

describe('submitEmailStep', () => {
  it('navigates to /auth/passport/start on the BACKEND origin', async () => {
    // The frontend and the API are different origins (see `lib/api.ts`'s API_BASE and the backend's
    // CORS_ORIGINS) and there is no Next rewrite proxying /api/* — a relative path here would hit
    // the frontend's own origin and 404 instead of ever reaching the redirect chain.
    const fetchResolveLogin = vi.fn().mockResolvedValue({ route: 'passport' });
    const navigate = vi.fn();

    const route = await submitEmailStep({ email: 'a@b.com', fetchResolveLogin, navigate });

    expect(route).toBe('passport');
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^https?:\/\/.+\/auth\/passport\/start$/)
    );
  });

  it('does not double up the API version prefix, which NEXT_PUBLIC_API_URL already carries', () => {
    expect(PASSPORT_START_URL).not.toMatch(/\/api\/v1\/api\/v1\//);
    expect(PASSPORT_START_URL).toMatch(/\/api\/v1\/auth\/passport\/start$/);
  });

  it('returns app-native without navigating, so the password field renders in place', async () => {
    const fetchResolveLogin = vi.fn().mockResolvedValue({ route: 'app-native' });
    const navigate = vi.fn();

    const route = await submitEmailStep({ email: 'a@b.com', fetchResolveLogin, navigate });

    expect(route).toBe('app-native');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes the typed email through to the router unchanged', async () => {
    const fetchResolveLogin = vi.fn().mockResolvedValue({ route: 'app-native' });

    await submitEmailStep({ email: 'Chef@Example.com', fetchResolveLogin, navigate: vi.fn() });

    expect(fetchResolveLogin).toHaveBeenCalledWith('Chef@Example.com');
  });

  it('propagates a rate-limit failure without navigating', async () => {
    const fetchResolveLogin = vi.fn().mockRejectedValue(new Error('429'));
    const navigate = vi.fn();

    await expect(
      submitEmailStep({ email: 'a@b.com', fetchResolveLogin, navigate })
    ).rejects.toThrow('429');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('emailStepErrorMessage', () => {
  it('names the rate limit, which is the one failure the visitor can act on', () => {
    expect(emailStepErrorMessage(new ApiError(429, 'Too many attempts'))).toBe(RATE_LIMIT_MESSAGE);
  });

  it('does not mislabel a server error as rate limiting', () => {
    expect(emailStepErrorMessage(new ApiError(500, 'boom'))).toBe(UNEXPECTED_ERROR_MESSAGE);
  });

  it('does not mislabel a 400 as rate limiting', () => {
    expect(emailStepErrorMessage(new ApiError(400, 'bad request'))).toBe(UNEXPECTED_ERROR_MESSAGE);
  });

  it('handles a network failure, which is not an ApiError at all', () => {
    expect(emailStepErrorMessage(new TypeError('Failed to fetch'))).toBe(UNEXPECTED_ERROR_MESSAGE);
  });

  it('handles a thrown non-Error without leaking it into the UI', () => {
    expect(emailStepErrorMessage('429')).toBe(UNEXPECTED_ERROR_MESSAGE);
  });
});
