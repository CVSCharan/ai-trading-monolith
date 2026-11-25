import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

export function SettingsPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const { data: growwStatus, refetch } = useQuery<{ connected: boolean; tokenValid?: boolean }>({
    queryKey: ['groww-status'],
    queryFn: async () => {
      const res = await fetch('/api/groww/status', { credentials: 'include' });
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const signInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Sign in failed');
      return res.json();
    },
    onSuccess: () => {
      setStatusMsg('Signed in!');
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const connectGrowwMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/groww/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totpToken, totpSecret }),
      });
      if (!res.ok) throw new Error('Failed to save Groww TOTP credentials');
      return res.json();
    },
    onSuccess: () => {
      setStatusMsg('Groww TOTP credentials encrypted & saved');
      setTotpToken('');
      setTotpSecret('');
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">Settings &amp; Groww TOTP Connection</h2>

      {statusMsg && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-300">
          {statusMsg}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="font-semibold text-white">Account Sign-In (Better Auth)</h3>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() => signInMutation.mutate()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
          >
            Sign In
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Groww TOTP Token + QR Secret</h3>
            <span className="text-xs text-slate-400">
              {growwStatus?.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <input
            placeholder="Groww TOTP Token (JWT)"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="password"
            placeholder="Base32 TOTP Secret (from QR)"
            value={totpSecret}
            onChange={(e) => setTotpSecret(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() => connectGrowwMutation.mutate()}
            disabled={!totpToken || !totpSecret}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Encrypt &amp; Save Groww Keys
          </button>
        </div>
      </div>
    </div>
  );
}
