'use client';

/**
 * Global authentication interceptor for handling token refresh and logout.
 * This allows the API layer to communicate with React Context without circular dependencies.
 */

type LogoutCallback = () => void;
let logoutCallback: LogoutCallback | null = null;

export function registerLogoutCallback(callback: LogoutCallback) {
  logoutCallback = callback;
}

export function triggerLogout() {
  // Clear the stored route to prevent redirecting back to a protected page
  if (typeof window !== 'undefined') {
    localStorage.removeItem('prepper_last_route');
  }

  if (logoutCallback) {
    logoutCallback();
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Attempts to refresh the access token using the refresh token.
 * Returns the new tokens if successful, null if refresh fails.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult | null> {
  try {
    console.log('Attempting to refresh access token...');
    const response = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Refresh token is invalid or expired
      console.warn('Token refresh failed with status:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Token refresh successful');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}
