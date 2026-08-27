import { useState, type FormEvent, type ReactNode } from 'react';
import { Nav } from '../components/Nav';
import { Corners } from '../components/Blueprint';
import { useStore } from '../lib/store';

/**
 * Gates the moderator queue. While the store is still resolving the session it
 * shows nothing; if authenticated it renders the queue; otherwise a password form.
 */
export function RequireModerator({ children }: { children: ReactNode }) {
  const { isModerator, loading, login, logout } = useStore();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="page-shell">
        <Nav />
        <div style={{ padding: 48, opacity: 0.6 }}>Checking session…</div>
      </div>
    );
  }

  if (isModerator) {
    return (
      <>
        <div style={{ position: 'fixed', top: 14, right: 18, zIndex: 50 }}>
          <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => logout()}>
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await login(password);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <Nav />
      <div style={{ maxWidth: 380, margin: '80px auto', padding: '0 20px' }}>
        <div className="kicker">Restricted</div>
        <h1 style={{ marginTop: 6, marginBottom: 4 }}>Moderator access</h1>
        <p style={{ opacity: 0.65, fontSize: 14, marginBottom: 24 }}>
          The review queue is gated. Enter the moderator password to continue.
        </p>

        <form className="blueprint" style={{ position: 'relative', padding: 24 }} onSubmit={onSubmit}>
          <Corners />
          <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.04em', marginBottom: 8, opacity: 0.7 }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: '1px solid var(--line, #2c3a4a)',
              color: 'inherit',
              fontFamily: 'inherit',
              marginBottom: 16,
            }}
          />
          {err && <div style={{ color: '#e06666', fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
