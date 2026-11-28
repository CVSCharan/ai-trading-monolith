// ============================================
// ForgotPasswordPage
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { fetchJson } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await fetchJson('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/login">
            <img src="/logo.svg" alt="AI Trader" className="h-10 w-10 mx-auto rounded-2xl" />
          </Link>
          <h1 className="mt-3 text-xl font-bold text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-400">We'll send you a secure link</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-6 shadow-xl">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Check your inbox</p>
              <p className="text-xs text-slate-500">
                If <span className="text-slate-300">{email}</span> is registered, a reset link
                has been sent. It expires in 1 hour.
              </p>
              <Link
                to="/login"
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@aitrader.in"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
