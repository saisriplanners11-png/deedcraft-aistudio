import type { User } from '@supabase/supabase-js';

export const POLICY_VERSION = '2026-11-26.3';
export type AccountProfile = {
  fullName: string;
  mobileNumber: string;
  businessName: string;
  profession: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
};

export function profileFor(user: User): AccountProfile {
  const source = user.user_metadata?.deedcraft_profile || {};
  const text = (key: keyof AccountProfile, fallback = '') => typeof source[key] === 'string' ? source[key] : fallback;
  return {
    fullName: text('fullName', user.user_metadata?.full_name || ''),
    mobileNumber: text('mobileNumber', user.phone ? '+' + user.phone.replace(/^\+/, '') : ''),
    businessName: text('businessName'), profession: text('profession'),
    addressLine1: text('addressLine1'), addressLine2: text('addressLine2'),
    locality: text('locality'), city: text('city'), district: text('district'),
    state: text('state'), postalCode: text('postalCode'), country: text('country', 'India'),
  };
}

export function internationalPhone(countryCode: string, number: string): string {
  const phone = countryCode.trim() + number.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error('Enter a valid country code and mobile number.');
  return phone;
}

export function accountReady(user: User): boolean {
  return !!(profileFor(user).fullName.trim() && user.email_confirmed_at && user.user_metadata?.deedcraft_terms?.version === POLICY_VERSION);
}
