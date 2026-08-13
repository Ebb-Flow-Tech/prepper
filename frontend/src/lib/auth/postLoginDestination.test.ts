import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_POST_LOGIN_DESTINATION,
  TASTING_REDIRECT_KEY,
  consumeTastingRedirect,
  rememberPostLoginDestination,
  resolvePostLoginDestination,
  sanitizeRelativeDestination,
} from './postLoginDestination';
import { LAST_ROUTE_KEY } from '@/lib/auth-interceptor';

/**
 * The four strings below all pass a naive `startsWith('/') && !startsWith('//')` check and still
 * leave the origin, because the URL parser normalises the string before resolving it. Each was
 * confirmed against Node's WHATWG parser to resolve to `https://evil.example/x`.
 */
const ORIGIN_ESCAPING_BYPASSES = [
  ['ASCII tab, stripped by the parser before parsing', '/\t/evil.example/x'],
  ['line feed, stripped the same way', '/\n/evil.example/x'],
  ['carriage return, stripped the same way', '/\r/evil.example/x'],
  ['backslash, which is a slash in a special scheme', '/\\evil.example/x'],
] as const;

describe('sanitizeRelativeDestination', () => {
  it.each(ORIGIN_ESCAPING_BYPASSES)('rejects %s', (_label, candidate) => {
    expect(sanitizeRelativeDestination(candidate)).toBeNull();
  });

  it.each(ORIGIN_ESCAPING_BYPASSES)(
    'confirms the premise — %s really does leave the origin when parsed',
    (_label, candidate) => {
      expect(new URL(candidate, window.location.origin).origin).not.toBe(window.location.origin);
    }
  );

  it('rejects the naive forms too', () => {
    expect(sanitizeRelativeDestination('javascript:alert(1)')).toBeNull();
    expect(sanitizeRelativeDestination('//evil.example/x')).toBeNull();
    expect(sanitizeRelativeDestination('https://evil.example')).toBeNull();
    expect(sanitizeRelativeDestination('')).toBeNull();
    expect(sanitizeRelativeDestination(null)).toBeNull();
  });

  it('returns the NORMALISED value, never the caller-supplied string', () => {
    // Handing back the raw string would pass the poisoned form to `location.assign` and the
    // check would have proved nothing.
    expect(sanitizeRelativeDestination('/recipes\t/42')).toBe('/recipes/42');
    expect(sanitizeRelativeDestination('/menu\\edit\\7')).toBe('/menu/edit/7');
  });

  it('keeps a legitimate path, its query and its hash', () => {
    expect(sanitizeRelativeDestination('/recipes/42?tab=costs#notes')).toBe(
      '/recipes/42?tab=costs#notes'
    );
  });
});

describe('resolvePostLoginDestination', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('falls back to the default when nothing is remembered', () => {
    expect(resolvePostLoginDestination('')).toBe(DEFAULT_POST_LOGIN_DESTINATION);
  });

  it('prefers ?redirect= over both stored keys', () => {
    localStorage.setItem(TASTING_REDIRECT_KEY, '/tastings/9');
    localStorage.setItem(LAST_ROUTE_KEY, '/menu');

    expect(resolvePostLoginDestination('?redirect=%2Frecipes%2F42')).toBe('/recipes/42');
  });

  it('prefers the tasting deep link over the last route', () => {
    localStorage.setItem(TASTING_REDIRECT_KEY, '/tastings/9');
    localStorage.setItem(LAST_ROUTE_KEY, '/menu');

    expect(resolvePostLoginDestination('')).toBe('/tastings/9');
  });

  it('falls back to the last route when nothing higher is set', () => {
    localStorage.setItem(LAST_ROUTE_KEY, '/menu');

    expect(resolvePostLoginDestination('')).toBe('/menu');
  });

  it('rejects a javascript: URL', () => {
    localStorage.setItem(LAST_ROUTE_KEY, 'javascript:alert(1)');

    expect(resolvePostLoginDestination('')).toBe(DEFAULT_POST_LOGIN_DESTINATION);
  });

  it('rejects a protocol-relative URL, which would leave the origin', () => {
    expect(resolvePostLoginDestination('?redirect=%2F%2Fevil.example%2Fx')).toBe(
      DEFAULT_POST_LOGIN_DESTINATION
    );
  });

  it('rejects an absolute URL on another origin', () => {
    expect(resolvePostLoginDestination('?redirect=https%3A%2F%2Fevil.example')).toBe(
      DEFAULT_POST_LOGIN_DESTINATION
    );
  });

  it.each(ORIGIN_ESCAPING_BYPASSES)(
    'does not resolve a poisoned ?redirect= (%s)',
    (_label, candidate) => {
      const search = `?redirect=${encodeURIComponent(candidate)}`;
      expect(resolvePostLoginDestination(search)).toBe(DEFAULT_POST_LOGIN_DESTINATION);
    }
  );

  it.each(ORIGIN_ESCAPING_BYPASSES)(
    'does not resolve a poisoned value persisted in localStorage (%s)',
    (_label, candidate) => {
      // The persistent half of the bug: the login page writes the resolved destination to
      // LAST_ROUTE_KEY before leaving for Passport, so an unsanitised value would survive the
      // round trip and be read back by the callback page AND by AuthGuard on every later visit.
      localStorage.setItem(LAST_ROUTE_KEY, candidate);
      expect(resolvePostLoginDestination('')).toBe(DEFAULT_POST_LOGIN_DESTINATION);
    }
  );

  it('skips a poisoned higher-priority source rather than dropping to the default', () => {
    localStorage.setItem(TASTING_REDIRECT_KEY, '/tastings/9');

    expect(resolvePostLoginDestination('?redirect=javascript%3Aalert(1)')).toBe('/tastings/9');
  });
});

describe('rememberPostLoginDestination', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('writes the key AuthGuard reads, so the two cannot disagree', () => {
    rememberPostLoginDestination('/tastings/9');

    expect(localStorage.getItem(LAST_ROUTE_KEY)).toBe('/tastings/9');
  });
});

describe('consumeTastingRedirect', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('removes the one-shot deep link and leaves the last route alone', () => {
    localStorage.setItem(TASTING_REDIRECT_KEY, '/tastings/9');
    localStorage.setItem(LAST_ROUTE_KEY, '/tastings/9');

    consumeTastingRedirect();

    expect(localStorage.getItem(TASTING_REDIRECT_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_ROUTE_KEY)).toBe('/tastings/9');
  });
});
