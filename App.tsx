import React, { useEffect, useState } from 'react';
import WizardApp from './wizard-app';
import type { WorkspacePresentation } from './workspace-presentation';
import './dashboard-version.css';

const preferenceKey = 'deedcraft.dashboard-version';
type DashboardVersion = 'classic' | 'registration';
export default function App() {
  const [version, setVersion] = useState<DashboardVersion>('classic');
  const [presentation, setPresentation] = useState<WorkspacePresentation>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function switchVersion(next: DashboardVersion) {
    setError('');
    setLoading(true);
    try {
      const nextPresentation = next === 'registration'
        ? (await import('./registration-workspace')).registrationPresentation : undefined;
      setPresentation(nextPresentation);
      setVersion(next);
      // Preferences are local to this browser; drafting works if storage is unavailable.
      try { localStorage.setItem(preferenceKey, next); } catch { /* Optional preference. */ }
    } catch {
      setError('Could not load that dashboard version. Your draft is unchanged. Please try again.');
    } finally { setLoading(false); }
  }
  useEffect(() => {
    try { if (localStorage.getItem(preferenceKey) === 'registration') void switchVersion('registration'); }
    catch { /* Start with Classic when browser storage is unavailable. */ }
  }, []);
  // Keep the same wizard mounted so switching cannot discard work or cancel uploads.
  return <WizardApp presentation={presentation} layoutControl={<div className="dashboard-version">
    <label htmlFor="dashboard-version">Dashboard version</label>
    <select id="dashboard-version" value={version} disabled={loading} aria-busy={loading} onChange={event => void switchVersion(event.target.value as DashboardVersion)}>
      <option value="classic">Classic</option><option value="registration">Registration (Preview)</option>
    </select>
    {loading && <span role="status">Switching layout…</span>}
    {error && <span role="alert">{error}</span>}
  </div>} />;
}
