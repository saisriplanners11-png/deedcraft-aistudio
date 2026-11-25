import './account-gate.css';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { auth } from './account';

export function AccountGate({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Session | null | undefined>(undefined);
  const [mode, setMode] = useState('Sign in');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const listener = auth?.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setMode('Update password');
      setActive(next);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

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
  if (active && mode !== 'Update password') return <div key={active.user.id}>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '8px 16px', alignItems: 'center' }}>
      <span>{active.user.email}</span>
      <button disabled={busy} onClick={() => void run(() => auth.auth.signOut())}>Sign out</button>
      {notice && <span role="status">{notice}</span>}
    </div>
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
    <p>{mode === 'Create account' ? 'Start with your email address and verify it to open your workspace.' :
      mode === 'Reset password' ? 'We’ll email you a link to choose a new password.' :
      mode === 'Update password' ? 'Choose a password with at least 8 characters.' : 'Open your saved drafts.'}</p>
    <form onSubmit={event => {
      event.preventDefault();
      const password = String(new FormData(event.currentTarget).get('password') || '');
      if (mode === 'Create account') void run(() => auth.auth.signUp({ email, password, options: { emailRedirectTo: redirect } }), 'Check your email for the verification link.');
      else if (mode === 'Reset password') void run(() => auth.auth.resetPasswordForEmail(email, { redirectTo: redirect }), 'If the account exists, check your email for the reset link.');
      else if (mode === 'Update password') void run(async () => {
        const result = await auth.auth.updateUser({ password });
        if (!result.error) setMode('Sign in');
        return result;
      });
      else void run(() => auth.auth.signInWithPassword({ email, password }));
    }}>
      {mode !== 'Update password' && <label>Email<br /><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
      {mode !== 'Reset password' && <label>Password<br /><input name="password" type="password" required minLength={mode === 'Sign in' ? undefined : 8} autoComplete={mode === 'Sign in' ? 'current-password' : 'new-password'} /></label>}
      <button disabled={busy}>{busy ? 'Please wait…' : mode}</button>
    </form>
    {mode !== 'Update password' && <div className="dc-auth-actions">
      <button disabled={busy} onClick={() => void run(() => auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } }))}>Continue with Google</button>
      {['Sign in', 'Create account', 'Reset password'].filter(value => value !== mode).map(value =>
        <button key={value} disabled={busy} onClick={() => { setMode(value); setNotice(''); }}>{value}</button>)}
      {email && <button disabled={busy} onClick={() => void run(() => auth.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } }), 'Check your email for the verification link.')}>Resend verification email</button>}
    </div>}
    <p role="status" className="dc-auth-notice">{notice}</p>
    </section>
  </main>;
}

