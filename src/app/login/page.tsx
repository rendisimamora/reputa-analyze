'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setToken } from '@/lib/api-client';
import { Radar } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? 'Login failed');
      return;
    }
    const j = await r.json();
    if (!j?.token) {
      setError('Login response missing token');
      return;
    }
    setToken(j.token);
    // Restore deep-link if the user was redirected here by apiFetch's 401 handler.
    let redirect = '/projects';
    try {
      const stored = sessionStorage.getItem('reputascan_redirect_after_login');
      if (stored) {
        sessionStorage.removeItem('reputascan_redirect_after_login');
        redirect = stored;
      }
    } catch { /* ignore */ }
    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500/15 border border-accent-500/30 text-accent-400">
            <Radar size={18} />
          </div>
          <div>
            <div className="font-semibold">ReputaScan ID</div>
            <div className="text-xs text-ink-400">Sign in to continue</div>
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="text-xs text-danger-500">{error}</div>}

        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>

        <div className="text-xs text-ink-400 text-center">
          New here? <Link href="/register" className="text-accent-400 hover:underline">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
