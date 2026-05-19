'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radar } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? 'Registration failed');
      return;
    }
    router.push('/projects');
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
            <div className="font-semibold">Create account</div>
            <div className="text-xs text-ink-400">Start monitoring in minutes</div>
          </div>
        </div>

        <div>
          <label className="label">Full name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password (min 8 chars)</label>
          <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="text-xs text-danger-500">{error}</div>}

        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>

        <div className="text-xs text-ink-400 text-center">
          Already have an account? <Link href="/login" className="text-accent-400 hover:underline">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
