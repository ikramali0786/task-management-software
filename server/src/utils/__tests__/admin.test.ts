import { describe, it, expect } from 'vitest';
import { isSuperAdmin } from '../admin';

/**
 * Admin gate — the SUPER_ADMIN_EMAILS allowlist that protects the support panel.
 * Defaults to the founder email (env default in config/env).
 */
describe('isSuperAdmin', () => {
  it('recognises the default super-admin (case-insensitive)', () => {
    expect(isSuperAdmin('ikram.ali3811@gmail.com')).toBe(true);
    expect(isSuperAdmin('IKRAM.ALI3811@GMAIL.COM')).toBe(true);
  });

  it('rejects everyone else and empty values', () => {
    expect(isSuperAdmin('someone@else.com')).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});
