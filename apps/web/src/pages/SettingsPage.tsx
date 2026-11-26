import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, ChevronDown, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface GrowwStatusResponse {
  connected: boolean;
  isActive?: boolean;
  source?: 'env' | 'db' | 'none';
  envConfigured?: boolean;
  maskedKey?: string | null;
  tokenValid?: boolean;
  tokenExpiresAt?: string;
  lastRefreshAt?: string;
}

interface UpstoxStatusResponse {
  analyticsConnected: boolean;
  tradingConnected: boolean;
  oauthConfigured: boolean;
  maskedAnalyticsToken: string | null;
  maskedAccessToken: string | null;
  algoName: string | null;
  activeDataBroker: 'groww' | 'upstox';
  activeExecutionBroker: 'groww' | 'upstox';
}

export function SettingsPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(2);
  const [maxPositions, setMaxPositions] = useState(3);
  const [perTradeRiskPct, setPerTradeRiskPct] = useState(1);
  const [shortOptionStopLossPct, setShortOptionStopLossPct] = useState(100);

  useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile', { credentials: 'include' });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        profile?: {
          riskLimits?: {
            maxDailyLossPct?: number;
            maxPositions?: number;
            perTradeRiskPct?: number;
            shortOptionStopLossPct?: number;
          };
        };
      };
      const rl = json.profile?.riskLimits;
      if (rl) {
        if (rl.maxDailyLossPct !== undefined) setMaxDailyLossPct(rl.maxDailyLossPct);
        if (rl.maxPositions !== undefined) setMaxPositions(rl.maxPositions);
        if (rl.perTradeRiskPct !== undefined) setPerTradeRiskPct(rl.perTradeRiskPct);
        if (rl.shortOptionStopLossPct !== undefined) setShortOptionStopLossPct(rl.shortOptionStopLossPct);
      }
      return json;
    },
  });

  const saveRiskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/user/risk-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maxDailyLossPct,
          maxPositions,
          perTradeRiskPct,
          shortOptionStopLossPct,
        }),
      });
      if (!res.ok) throw new Error('Failed to update risk limits');
      return res.json();
    },
    onSuccess: () => setStatusMsg('Risk guardrails saved & audit-logged.'),
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const { data: growwStatus, refetch } = useQuery<GrowwStatusResponse>({
    queryKey: ['groww-status'],
    queryFn: async () => {
      const res = await fetch('/api/groww/status', { credentials: 'include' });
      if (!res.ok) return { connected: false, source: 'none' };
      return res.json();
    },
  });

  const { data: upstoxStatus, refetch: refetchUpstox } = useQuery<UpstoxStatusResponse>({
    queryKey: ['upstox-status'],
    queryFn: async () => {
      const res = await fetch('/api/upstox/status', { credentials: 'include' });
      if (!res.ok) {
        return {
          analyticsConnected: false,
          tradingConnected: false,
          oauthConfigured: false,
          maskedAnalyticsToken: null,
          maskedAccessToken: null,
          algoName: null,
          activeDataBroker: 'groww',
          activeExecutionBroker: 'groww',
        };
      }
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
      setStatusMsg('Signed in to AI Trader.');
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const syncTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/groww/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string; source?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to sync Groww access token');
      return json;
    },
    onSuccess: (data) => {
      setStatusMsg(`Groww access token synced successfully (source: ${data.source ?? 'env'}).`);
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
      setStatusMsg('Groww TOTP credentials encrypted & saved in DB.');
      setTotpToken('');
      setTotpSecret('');
      setShowManualOverride(false);
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">Settings &amp; Groww Connection</h2>
        <p className="text-sm text-slate-400">
          Operator session, `.env` / DB-encrypted Groww TOTP token health, and risk guardrails
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">
          {statusMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-sky-400" />
              Account Sign-In (Better Auth)
            </CardTitle>
            <CardDescription>Required to manage strategies, paper runs, and Groww tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="email"
              placeholder="Operator Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
            <Button variant="primary" onClick={() => signInMutation.mutate()} disabled={!email || !password}>
              Sign In
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Groww API &amp; TOTP Status
              </CardTitle>
              <CardDescription>Uses `.env` TOTP secrets automatically or DB-encrypted keys</CardDescription>
            </div>
            <Badge variant={growwStatus?.connected ? 'success' : 'warning'}>
              {growwStatus?.connected ? `Connected (${growwStatus.source ?? 'env'})` : 'Sign in / Not linked'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Credential Source</span>
                <span className="font-mono text-slate-100 uppercase">{growwStatus?.source ?? 'none'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Masked Key</span>
                <span className="font-mono text-slate-200">{growwStatus?.maskedKey ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Access Token</span>
                <span className="font-mono text-slate-200">
                  {growwStatus?.tokenValid ? 'Valid' : 'Needs sync'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => syncTokenMutation.mutate()}
                disabled={syncTokenMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Test / Refresh Access Token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualOverride((v) => !v)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Override Keys Manually
              </Button>
            </div>

            {showManualOverride && (
              <div className="space-y-2.5 border-t border-slate-800 pt-3">
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => connectGrowwMutation.mutate()}
                  disabled={!totpToken || !totpSecret}
                >
                  Encrypt &amp; Save Override
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-400" />
              Upstox Analytics &amp; Trading (API v3)
            </CardTitle>
            <CardDescription>
              1-year read-only Analytics Token for market data &amp; option chain; Static IP + OAuth required for v3 live orders
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={upstoxStatus?.analyticsConnected ? 'success' : 'warning'}>
              {upstoxStatus?.analyticsConnected ? 'Analytics Linked (.env)' : 'Analytics Not Set'}
            </Badge>
            <Badge variant={upstoxStatus?.tradingConnected ? 'success' : 'info'}>
              {upstoxStatus?.tradingConnected ? 'v3 Trading Ready' : 'Read-Only'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">Active Data Broker</div>
              <div className="mt-1 font-mono font-semibold uppercase text-emerald-400">
                {upstoxStatus?.activeDataBroker ?? 'groww'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">Active Execution Broker</div>
              <div className="mt-1 font-mono font-semibold uppercase text-sky-400">
                {upstoxStatus?.activeExecutionBroker ?? 'groww'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">Analytics Token (.env)</div>
              <div className="mt-1 font-mono text-slate-200">
                {upstoxStatus?.maskedAnalyticsToken ?? 'Not configured'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">Algo Name (X-Algo-Name)</div>
              <div className="mt-1 font-mono text-slate-200">
                {upstoxStatus?.algoName ?? '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
            <span>
              Set <code className="text-slate-200">UPSTOX_ANALYTICS_TOKEN</code> in <code className="text-slate-200">.env</code> for 1-year Option Chain, Historical Candles &amp; Quotes (no Static IP needed).
            </span>
            <Button variant="outline" size="sm" onClick={() => void refetchUpstox()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Risk &amp; Execution Guardrails</CardTitle>
            <CardDescription>Server-enforced limits applied to all Paper &amp; Live 9/21 EMA sessions</CardDescription>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => saveRiskMutation.mutate()}
            disabled={saveRiskMutation.isPending}
          >
            {saveRiskMutation.isPending ? 'Saving…' : 'Save Risk Limits'}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Max Daily Loss (%)</span>
            <input
              type="number"
              step="0.1"
              min={0.1}
              max={20}
              value={maxDailyLossPct}
              onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
              className="mt-1.5 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm font-semibold text-rose-400 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Max Open Positions</span>
            <input
              type="number"
              min={1}
              max={20}
              value={maxPositions}
              onChange={(e) => setMaxPositions(Number(e.target.value))}
              className="mt-1.5 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm font-semibold text-white focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Per-Trade Risk (%)</span>
            <input
              type="number"
              step="0.1"
              min={0.1}
              max={10}
              value={perTradeRiskPct}
              onChange={(e) => setPerTradeRiskPct(Number(e.target.value))}
              className="mt-1.5 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm font-semibold text-sky-400 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-slate-400">Unconditional Square-Off</div>
            <div className="mt-2 flex items-center gap-1.5 font-mono text-base font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> 15:00 IST
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
