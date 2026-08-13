import { describe, expect, it } from 'vitest';
import { parsePassportCallbackFragment } from './parseFragment';

describe('parsePassportCallbackFragment', () => {
  it('extracts both tokens from a well-formed fragment', () => {
    expect(parsePassportCallbackFragment('access_token=abc&refresh_token=xyz')).toEqual({
      ok: true,
      accessToken: 'abc',
      refreshToken: 'xyz',
    });
  });

  it("handles a leading '#' the same as a bare hash string", () => {
    expect(parsePassportCallbackFragment('#access_token=abc&refresh_token=xyz')).toEqual({
      ok: true,
      accessToken: 'abc',
      refreshToken: 'xyz',
    });
  });

  it('fails when access_token is missing', () => {
    expect(parsePassportCallbackFragment('refresh_token=xyz')).toEqual({ ok: false });
  });

  it('fails when refresh_token is missing — a session with no way to refresh is not a session', () => {
    expect(parsePassportCallbackFragment('access_token=abc')).toEqual({ ok: false });
  });

  it('fails on an empty fragment', () => {
    expect(parsePassportCallbackFragment('')).toEqual({ ok: false });
  });

  it('fails on a bare hash, which is what a stripped fragment leaves behind', () => {
    expect(parsePassportCallbackFragment('#')).toEqual({ ok: false });
  });

  it('ignores extra unrelated params', () => {
    expect(
      parsePassportCallbackFragment('access_token=abc&refresh_token=xyz&expires_in=3600')
    ).toEqual({ ok: true, accessToken: 'abc', refreshToken: 'xyz' });
  });

  it('percent-decodes the token values', () => {
    expect(parsePassportCallbackFragment('access_token=a%2Bb&refresh_token=x%2Fy')).toEqual({
      ok: true,
      accessToken: 'a+b',
      refreshToken: 'x/y',
    });
  });
});
