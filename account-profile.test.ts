import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { accountReady, internationalPhone, POLICY_VERSION, profileFor } from './account-profile';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'account-a', aud: 'authenticated', created_at: '', app_metadata: {},
    email: 'example@example.com', email_confirmed_at: '2026-11-26',
    phone: '919876543210', phone_confirmed_at: '2026-11-26',
    user_metadata: { deedcraft_profile: { fullName: 'Example Person' }, deedcraft_terms: { version: POLICY_VERSION } },
    ...overrides,
  };
}

describe('account completion', () => {
  it('requires provider-confirmed email while phone verification is optional', () => {
    expect(accountReady(user())).toBe(true);
    expect(accountReady(user({ email_confirmed_at: undefined }))).toBe(false);
    expect(accountReady(user({ phone_confirmed_at: undefined }))).toBe(true);
    expect(accountReady(user({ phone: '', phone_confirmed_at: undefined }))).toBe(true);
    expect(accountReady(user({ user_metadata: { phone_verified: true, email_verified: true } }))).toBe(false);
  });
  it('requires current policies and a name, with address optional', () => {
    expect(accountReady(user({ user_metadata: { deedcraft_profile: { fullName: ' ' }, deedcraft_terms: { version: POLICY_VERSION } } }))).toBe(false);
    expect(accountReady(user({ user_metadata: { deedcraft_profile: { fullName: 'Example' }, deedcraft_terms: { version: 'older' } } }))).toBe(false);
    expect(profileFor(user()).addressLine1).toBe('');
    expect(profileFor(user()).country).toBe('India');
  });
  it('normalises the mobile number without guessing a country code', () => {
    expect(internationalPhone('+91', '98765 43210')).toBe('+919876543210');
    expect(internationalPhone('+44', '(7700) 900123')).toBe('+447700900123');
    for (const number of ['abc', '12', '+919876543210']) expect(() => internationalPhone('+91', number)).toThrow();
  });
});
