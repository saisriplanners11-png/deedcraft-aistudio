import './account-gate.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { auth } from './account';
import { POLICY_VERSION } from './account-profile';
import { AccountProfileForm } from './account-profile-form';
import { AccountPolicies } from './account-policies';

export function AccountGate({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Session | null | undefined>(undefined);
  const [mode, setMode] = useState('Sign in');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const accountId = useRef<string | null>(null);
  useEffect(() => {
    const listener = auth?.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setMode('Update password');
      if (accountId.current !== (next?.user.id ?? null)) {
        setEditingProfile(false);
        setNotice('');
        accountId.current = next?.user.id ?? null;
      }
      setActive(next);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

  const policy = new URLSearchParams(location.search).get('policy');
  if (policy === 'terms' || policy === 'privacy') return <AccountPolicies kind={policy} />;

  const redirect = location.origin + location.pathname;
  async function run(action: () => Promise<{ error: Error | null }>, success = '') {
    setBusy(true);
    setNotice('');
    try {
      const { error } = await action();
      if (error) throw error;
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  }

  if (!auth) return <main>DeedCraft account service needs configuration.</main>;
  if (active === undefined) return <main role="status">Checking your session…</main>;
  if (active && mode !== 'Update password' && editingProfile) {
    return <AccountProfileForm key={active.user.id} user={active.user} onDone={() => setEditingProfile(false)} />;
  }
  if (active && mode !== 'Update password') return <div key={active.user.id}>
    <nav className="dc-account-bar" aria-label="Account">
      <span className="dc-account-email">{active.user.email}</span>
      <button className="dc-account-button dc-account-profile" disabled={busy} onClick={() => setEditingProfile(true)}>
        <UserRound size={18} aria-hidden="true" /> <span>Profile</span>
      </button>
      <button className="dc-account-button dc-account-signout" disabled={busy} onClick={() => void run(() => auth.auth.signOut())}>
        <LogOut size={18} aria-hidden="true" /> <span>{busy ? 'Signing out…' : 'Sign out'}</span>
      </button>
      {notice && <span className="dc-account-notice" role="status">{notice}</span>}
    </nav>
    {children}
  </div>;

  return <main className="dc-auth">
    <section className="dc-auth-intro">
      <div className="dc-auth-brand"><span aria-hidden="true">D</span> DeedCraft</div>
      <div><h2>Your drafting workspace.</h2>
      <p>Prepare deeds, applications and property plans in one place.</p></div>
      <p>Draft details sync to your account. Source files stay on the device where you add them.</p>
    </section>
    <section className="dc-auth-panel" aria-labelledby="dc-auth-title">
    <h1 id="dc-auth-title">{mode}</h1>
    <p>{mode === 'Create account' ? 'Create your account, verify your email, then complete your profile.' :
      mode === 'Verify email' ? 'Open the link in your email, then sign in to complete your profile.' :
      mode === 'Reset password' ? 'We’ll email you a link to choose a new password.' :
      mode === 'Update password' ? 'Choose a password with at least 8 characters.' : 'Open your saved drafts.'}</p>
    <form onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const password = String(fields.get('password') || '');
      if (mode === 'Create account') {
        const fullName = String(fields.get('fullName') || '').trim();
        if (!fullName) { setNotice('Enter your full name.'); return; }
        if (password !== fields.get('confirmPassword')) { setNotice('The passwords do not match.'); return; }
        if (!accepted) { setNotice('Read and accept the Terms of Service and Privacy Policy.'); return; }
        void run(async () => {
          const result = await auth.auth.signUp({ email: email.trim(), password, options: {
            emailRedirectTo: redirect,
            data: { full_name: fullName, deedcraft_profile: { fullName },
              deedcraft_terms: { version: POLICY_VERSION, acceptedAt: new Date().toISOString() } },
          } });
          if (!result.error) { setVerificationEmail(email.trim()); setMode('Verify email'); }
          return result;
        }, 'Check your email for the verification link. After confirming, sign in to complete your profile.');
      }
      else if (mode === 'Verify email') void run(() => auth.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect } }), 'Check your email for the verification link.');
      else if (mode === 'Reset password') void run(() => auth.auth.resetPasswordForEmail(email, { redirectTo: redirect }), 'If the account exists, check your email for the reset link.');
      else if (mode === 'Update password') void run(async () => {
        const result = await auth.auth.updateUser({ password });
        if (!result.error) setMode('Sign in');
        return result;
      });
      else void run(() => auth.auth.signInWithPassword({ email, password }));
    }}>
      {mode === 'Create account' && <label>Full name<input name="fullName" autoComplete="name" required maxLength={240} /></label>}
      {mode !== 'Update password' && <label>Email<br /><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
      {!['Reset password', 'Verify email'].includes(mode) && <label>Password<br /><input name="password" type="password" required minLength={mode === 'Sign in' ? undefined : 8} autoComplete={mode === 'Sign in' ? 'current-password' : 'new-password'} /></label>}
      {mode === 'Create account' && <>
        <label>Confirm password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label className="dc-auth-checkbox"><input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} />
          <span>I accept the <a href="/?policy=terms" target="_blank" rel="noopener">Terms of Service</a> and acknowledge the <a href="/?policy=privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span>
        </label>
      </>}
      <button disabled={busy}>{busy ? 'Please wait…' : mode === 'Verify email' ? 'Resend verification email' : mode}</button>
    </form>
    {mode !== 'Update password' && <div className="dc-auth-actions">
      <button disabled={busy} onClick={() => void run(() => auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } }))}>Continue with Google</button>
      {['Sign in', 'Create account', 'Reset password'].filter(value => value !== mode).map(value =>
        <button key={value} disabled={busy} onClick={() => { setMode(value); setNotice(''); }}>{value}</button>)}
      {verificationEmail && <p>Verification pending for {verificationEmail}. Correct the email field and register again if it was mistyped.</p>}
      {email && mode !== 'Verify email' && <button disabled={busy} onClick={() => void run(() => auth.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect } }), 'Check your email for the verification link.')}>Resend verification email</button>}
    </div>}
    <p role="status" className="dc-auth-notice">{notice}</p>
    </section>
  </main>;
}

