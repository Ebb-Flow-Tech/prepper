/** Generate a unique test name with timestamp to avoid collisions */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

/** Wait helpers */
export const DEBOUNCE_WAIT = 400; // 300ms debounce + buffer

/** Test user credentials — read from env vars, fall back to defaults */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'testuser@prepper.test',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  username: process.env.TEST_USER_USERNAME || 'testuser',
};

export const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@prepper.test',
  password: process.env.TEST_ADMIN_PASSWORD || 'adminpassword123',
  username: process.env.TEST_ADMIN_USERNAME || 'admin',
};

/** XSS payloads for input sanitization tests */
export const XSS_PAYLOAD = '<script>alert(1)</script>';

/** Long strings for boundary tests */
export const LONG_STRING_100 = 'a'.repeat(100);
export const LONG_STRING_500 = 'a'.repeat(500);
