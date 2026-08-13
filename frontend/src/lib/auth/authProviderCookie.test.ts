import { describe, expect, it } from 'vitest';
import {
  AUTH_PROVIDER_COOKIE_NAME,
  AUTH_PROVIDER_COOKIE_OPTIONS,
  readAuthProviderCookie,
  type AuthProvider,
} from './authProviderCookie';

describe('readAuthProviderCookie', () => {
  it('returns the provider when the cookie is present', () => {
    expect(readAuthProviderCookie(`${AUTH_PROVIDER_COOKIE_NAME}=passport`)).toBe('passport');
    expect(readAuthProviderCookie(`${AUTH_PROVIDER_COOKIE_NAME}=app-native`)).toBe('app-native');
  });

  it('defaults to app-native when the cookie is absent — the safe pre-SSO baseline', () => {
    expect(readAuthProviderCookie('')).toBe('app-native');
    expect(readAuthProviderCookie('other_cookie=1')).toBe('app-native');
  });

  it('defaults to app-native on a garbage value rather than trusting it', () => {
    expect(readAuthProviderCookie(`${AUTH_PROVIDER_COOKIE_NAME}=nonsense`)).toBe('app-native');
  });

  it('finds the target cookie mixed among siblings, as document.cookie always presents them', () => {
    expect(
      readAuthProviderCookie(`session=abc; ${AUTH_PROVIDER_COOKIE_NAME}=passport; other=xyz`)
    ).toBe('passport');
  });

  it("isn't confused by an adjacent cookie whose value itself contains '='", () => {
    const provider: AuthProvider = 'app-native';
    expect(readAuthProviderCookie(`token=abc=def; ${AUTH_PROVIDER_COOKIE_NAME}=${provider}`)).toBe(
      provider
    );
  });

  it("cookie options match @supabase/ssr's own session-cookie defaults", () => {
    expect(AUTH_PROVIDER_COOKIE_OPTIONS).toEqual({
      path: '/',
      sameSite: 'lax',
      maxAge: 400 * 24 * 60 * 60,
      httpOnly: false,
    });
  });
});
