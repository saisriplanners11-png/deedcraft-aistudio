import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { auth } from './account';
import { accountReady, POLICY_VERSION, profileFor, type AccountProfile } from './account-profile';

export function AccountProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [current, setCurrent] = useState(user);
  const [profile, setProfile] = useState(() => profileFor(user));
  const [nextEmail, setNextEmail] = useState('');
  const [accepted, setAccepted] = useState(user.user_metadata?.deedcraft_terms?.version === POLICY_VERSION);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function perform(action: () => Promise<string>) {
    setBusy(true);
    setNotice('');
    try { setNotice(await action()); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function refreshUser() {
    const { data, error } = await auth.auth.getUser();
    if (error) throw error;
    setCurrent(data.user);
    return data.user;
  }

  function field(key: keyof AccountProfile, label: string, autoComplete?: string) {
    return <label>{label}<input value={profile[key]} maxLength={key === 'postalCode' ? 20 : 240}
      required={key === 'fullName'} autoComplete={autoComplete}
      onChange={event => setProfile(previous => ({ ...previous, [key]: event.target.value }))} /></label>;
  }

  return <main className="dc-auth dc-profile">
    <section className="dc-auth-intro">
      <div className="dc-auth-brand"><span aria-hidden="true">D</span> DeedCraft</div>
      <div><h2>Your account details.</h2><p>Verify your email and complete your profile to open your workspace.</p></div>
      <button type="button" disabled={busy} onClick={() => void perform(async () => {
        const { error } = await auth.auth.signOut();
        if (error) throw error;
        return '';
      })}>Sign out</button>
    </section>
    <section className="dc-auth-panel" aria-labelledby="dc-profile-title">
      <h1 id="dc-profile-title">Your profile</h1>
      <section className="dc-verification" aria-labelledby="dc-email-title">
        <h3 id="dc-email-title">Email verification</h3>
        <p>{current.email} <strong>{current.email_confirmed_at ? 'Verified' : 'Verification required'}</strong></p>
        <button type="button" disabled={busy} onClick={() => void perform(async () => {
          const { error } = await auth.auth.resend({ type: 'signup', email: current.email,
            options: { emailRedirectTo: location.origin + location.pathname } });
          if (error) throw error;
          return 'Verification email sent. Check your inbox.';
        })}>Resend verification email</button>
        <details><summary>Change email address</summary>
          <form onSubmit={event => {
            event.preventDefault();
            void perform(async () => {
              const { error } = await auth.auth.updateUser({ email: nextEmail.trim() },
                { emailRedirectTo: location.origin + location.pathname });
              if (error) throw error;
              return 'Check your new email and, if requested, your current email to confirm the change. Your current address stays in use until confirmation.';
            });
          }}>
            <label>New email address<input type="email" required autoComplete="email" value={nextEmail}
              onChange={event => setNextEmail(event.target.value)} /></label>
            <button disabled={busy}>Send email change confirmation</button>
          </form>
        </details>
      </section>

      <form onSubmit={event => {
        event.preventDefault();
        void perform(async () => {
          if (!accepted) throw new Error('Read and accept the Terms of Service and Privacy Policy.');
          const fullName = profile.fullName.trim();
          if (!fullName) throw new Error('Enter your full name.');
          const mobileNumber = profile.mobileNumber.trim().replace(/[\s()-]/g, '');
          if (!/^\+[1-9]\d{6,14}$/.test(mobileNumber)) throw new Error('Enter your mobile number with country code, for example +919876543210.');
          const { data, error } = await auth.auth.updateUser({ data: {
            full_name: fullName, deedcraft_profile: { ...profile, fullName, mobileNumber },
            deedcraft_terms: { version: POLICY_VERSION, acceptedAt: current.user_metadata?.deedcraft_terms?.version === POLICY_VERSION
              ? current.user_metadata.deedcraft_terms.acceptedAt : new Date().toISOString() },
          } });
          if (error) throw error;
          setCurrent(data.user);
          if (accountReady(data.user)) onDone();
          return accountReady(data.user) ? 'Profile saved.' : 'Profile saved. Complete email verification to continue.';
        });
      }}>
        {field('fullName', 'Full name', 'name')}
        <label>Mobile number<input type="tel" required autoComplete="tel" value={profile.mobileNumber} maxLength={24} placeholder="+91" onChange={event => setProfile(previous => ({ ...previous, mobileNumber: event.target.value }))} /></label>
        <p>Enter the country code with your contact number.</p>
        {field('businessName', 'Business or office name (optional)', 'organization')}
        <label>Profession (optional)<input list="dc-professions" value={profile.profession} maxLength={120}
          onChange={event => setProfile(previous => ({ ...previous, profession: event.target.value }))} /></label>
        <datalist id="dc-professions"><option>Document writer</option><option>Advocate</option><option>Individual</option><option>Other</option></datalist>
        <fieldset><legend>Communication address (optional)</legend>
          {field('addressLine1', 'Address line 1', 'address-line1')}
          {field('addressLine2', 'Address line 2', 'address-line2')}
          {field('locality', 'Locality')}
          <div className="dc-field-row">{field('city', 'City or town', 'address-level2')}{field('district', 'District')}</div>
          <div className="dc-field-row">{field('state', 'State', 'address-level1')}{field('postalCode', 'PIN / postal code', 'postal-code')}</div>
          {field('country', 'Country', 'country-name')}
        </fieldset>
        <label className="dc-auth-checkbox"><input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} />
          <span>I accept the <a href="/?policy=terms" target="_blank" rel="noopener">Terms of Service</a> and acknowledge the <a href="/?policy=privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span>
        </label>
        <button disabled={busy}>Save profile and continue</button>
      </form>
      <button type="button" disabled={busy} onClick={() => void perform(async () => {
        const updated = await refreshUser();
        if (accountReady(updated)) onDone();
        return 'Verification status refreshed.';
      })}>Refresh verification status</button>
      <p role="status" className="dc-auth-notice">{notice}</p>
    </section>
  </main>;
}
