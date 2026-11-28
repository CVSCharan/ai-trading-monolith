import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, ChevronDown, KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';

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

interface TwoFactorStatusResponse {
  enabled: boolean;
  enabledAt: string | null;
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
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  const { data: twoFactorStatus, refetch: refetch2FA } = useQuery<TwoFactorStatusResponse>({
    queryKey: ['2fa-status'],
    queryFn: () => fetchJson<TwoFactorStatusResponse>('/api/auth/2fa/status', { credentials: 'include' }),
  });

  const setup2FAMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ secret: string; uri: string }>('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      }),
    onSuccess: (data) => {
      setTwoFactorSetupData(data);
      setStatusMsg('2FA secret generated. Scan or copy it into your authenticator app.');
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const verify2FAMutation = useMutation({
    mutationFn: ({ code, secret }: { code: string; secret: string }) =>
      fetchJson('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, secret }),
      }),
    onSuccess: () => {
      setTwoFactorSetupData(null);
      setTwoFactorVerifyCode('');
      setStatusMsg('Operator 2FA successfully activated.');
      void refetch2FA();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const disable2FAMutation = useMutation({
    mutationFn: (code: string) =>
      fetchJson('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      setShowDisable2FA(false);
      setTwoFactorDisableCode('');
      setStatusMsg('Operator 2FA disabled.');
      void refetch2FA();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const { error: profileError, isLoading: isProfileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const json = await fetchJson<{
        profile?: {
          riskLimits?: {
            maxDailyLossPct?: number;
            maxPositions?: number;
            perTradeRiskPct?: number;
            shortOptionStopLossPct?: number;
          };
        };
      }>('/api/user/profile', { credentials: 'include' });
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
    mutationFn: () =>
      fetchJson('/api/user/risk-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maxDailyLossPct,
          maxPositions,
          perTradeRiskPct,
          shortOptionStopLossPct,
        }),
      }),
    onSuccess: () => setStatusMsg('Risk guardrails saved & audit-logged.'),
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const { data: growwStatus, refetch, error: growwError } = useQuery<GrowwStatusResponse>({
    queryKey: ['groww-status'],
    queryFn: () => fetchJson<GrowwStatusResponse>('/api/groww/status', { credentials: 'include' }),
  });

  const { data: upstoxStatus, refetch: refetchUpstox, error: upstoxError } = useQuery<UpstoxStatusResponse>({
    queryKey: ['upstox-status'],
    queryFn: () => fetchJson<UpstoxStatusResponse>('/api/upstox/status', { credentials: 'include' }),
  });

  const signInMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      setStatusMsg('Signed in to AI Trader.');
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const syncTokenMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ source?: string }>('/api/groww/sync', {
        method: 'POST',
        credentials: 'include',
      }),
    onSuccess: (data) => {
      setStatusMsg(`Groww access token synced successfully (source: ${data.source ?? 'env'}).`);
      void refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const connectGrowwMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/groww/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totpToken, totpSecret }),
      }),
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
        <h2 className="text-2xl font-semibold tracking-tight text-white">Settings &amp; Broker Connections</h2>
        <p className="text-sm text-slate-400">
          Operator session, broker TOTP &amp; OAuth integrations (Groww &amp; Upstox), and risk guardrails
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">
          {statusMsg}
        </div>
      )}
      {profileError && <QueryErrorState error={profileError} title="Saved risk limits could not be loaded" />}
      {growwError && <QueryErrorState error={growwError} onRetry={() => void refetch()} title="Groww credential status is unavailable" />}
      {upstoxError && <QueryErrorState error={upstoxError} onRetry={() => void refetchUpstox()} title="Upstox status is unavailable" />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-sky-400" />
              Account Sign-In (Better Auth)
            </CardTitle>
            <CardDescription>Required to manage strategies, paper runs, and broker connections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="email"
              placeholder="Operator Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                <Smartphone className="h-4 w-4 text-sky-400" />
                Operator Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription>
                RFC 6238 TOTP authenticator required for live trading step-up verification
              </CardDescription>
            </div>
            <Badge variant={twoFactorStatus?.enabled ? 'success' : 'warning'}>
              {twoFactorStatus?.enabled ? '2FA Enrolled & Active' : '2FA Not Enrolled'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {twoFactorStatus?.enabled ? (
              <div className="space-y-3">
                <div className="space-y-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Operator hardware/app TOTP protection is active
                  </div>
                  <p className="text-slate-400">
                    Live trading activation gate passes. Every live enablement requires a 6-digit dynamic TOTP code.
                  </p>
                  {twoFactorStatus.enabledAt && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Enrolled: {new Date(twoFactorStatus.enabledAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                {!showDisable2FA ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisable2FA(true)}
                  >
                    Disable Operator 2FA
                  </Button>
                ) : (
                  <div className="space-y-2.5 rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-xs">
                    <p className="text-rose-300 font-medium">
                      Enter current 6-digit TOTP code to confirm disabling 2FA:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={twoFactorDisableCode}
                        onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/\D/g, ''))}
                        className="w-36 font-mono text-center tracking-widest text-sm text-white"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => disable2FAMutation.mutate(twoFactorDisableCode)}
                        disabled={twoFactorDisableCode.length !== 6 || disable2FAMutation.isPending}
                      >
                        {disable2FAMutation.isPending ? 'Disabling…' : 'Confirm Disable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDisable2FA(false);
                          setTwoFactorDisableCode('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {!twoFactorSetupData ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      Link Google Authenticator, Authy, or 1Password to protect live capital deployment and satisfy the mandatory live trading gate.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setup2FAMutation.mutate()}
                      disabled={setup2FAMutation.isPending}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      {setup2FAMutation.isPending ? 'Generating Secret…' : 'Enroll Authenticator 2FA'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
                    <div>
                      <span className="text-slate-400">Manual Entry Key (Base32):</span>
                      <div className="mt-1 select-all rounded bg-slate-900 p-2 font-mono text-xs font-semibold text-sky-300">
                        {twoFactorSetupData.secret}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Authenticator URI:</span>
                      <div className="mt-1 break-all rounded bg-slate-900 p-1.5 font-mono text-[10px] text-slate-400">
                        {twoFactorSetupData.uri}
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="text-slate-300 font-medium">Verify with 6-digit code from your app:</span>
                      <div className="mt-2 flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={twoFactorVerifyCode}
                          onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                          className="w-36 font-mono text-center tracking-widest text-sm text-white"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            verify2FAMutation.mutate({
                              code: twoFactorVerifyCode,
                              secret: twoFactorSetupData.secret,
                            })
                          }
                          disabled={twoFactorVerifyCode.length !== 6 || verify2FAMutation.isPending}
                        >
                          {verify2FAMutation.isPending ? 'Verifying…' : 'Verify & Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTwoFactorSetupData(null);
                            setTwoFactorVerifyCode('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-sky-400" />
                Operator 2FA (TOTP)
              </CardTitle>
              <CardDescription>Mandatory step-up authenticator required to unlock live trading</CardDescription>
            </div>
            <Badge variant={twoFactorStatus?.enabled ? 'success' : 'warning'}>
              {twoFactorStatus?.enabled ? '2FA Active' : 'Not Enrolled'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {!twoFactorStatus?.enabled && !twoFactorSetupData && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Enroll an RFC 6238 authenticator app (Google Authenticator, Authy, 1Password) to satisfy the live trading gate and protect execution commands.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setup2FAMutation.mutate()}
                  disabled={setup2FAMutation.isPending}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {setup2FAMutation.isPending ? 'Generating Secret…' : 'Enroll Authenticator App'}
                </Button>
              </div>
            )}

            {!twoFactorStatus?.enabled && twoFactorSetupData && (
              <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-950/20 p-3 text-xs">
                <div>
                  <span className="text-slate-400">Authenticator Secret Key (Base32):</span>
                  <div className="mt-1 flex items-center justify-between rounded bg-slate-900 px-2.5 py-1.5 font-mono font-bold text-sky-300 select-all">
                    <span>{twoFactorSetupData.secret}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Add this key as a Time-based (TOTP) account in Google Authenticator or 1Password.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-slate-300 font-medium">Verify 6-digit Code to Activate:</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={twoFactorVerifyCode}
                      onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                      className="w-36 font-mono text-center text-sm font-semibold text-white tracking-widest focus:border-sky-500"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        verify2FAMutation.mutate({
                          code: twoFactorVerifyCode,
                          secret: twoFactorSetupData.secret,
                        })
                      }
                      disabled={twoFactorVerifyCode.length !== 6 || verify2FAMutation.isPending}
                    >
                      {verify2FAMutation.isPending ? 'Verifying…' : 'Activate 2FA'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTwoFactorSetupData(null);
                        setTwoFactorVerifyCode('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {twoFactorStatus?.enabled && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Operator 2FA Enrolled &amp; Protected
                  </div>
                  <p className="mt-1 text-slate-400">
                    Enrolled {twoFactorStatus.enabledAt ? new Date(twoFactorStatus.enabledAt).toLocaleString('en-IN') : 'Active'}.
                    Live trading gate &lsquo;Operator 2FA&rsquo; is passing.
                  </p>
                </div>

                {!showDisable2FA ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisable2FA(true)}
                  >
                    Disable Operator 2FA
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-rose-300">
                      <ShieldAlert className="h-4 w-4" />
                      Confirm 2FA Deactivation
                    </div>
                    <p className="text-slate-400">
                      Disabling 2FA will immediately fail live trading gates. Enter your current 6-digit TOTP code to confirm.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={twoFactorDisableCode}
                        onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/\D/g, ''))}
                        className="w-32 font-mono text-center text-sm font-semibold text-white tracking-widest focus:border-rose-500"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => disable2FAMutation.mutate(twoFactorDisableCode)}
                        disabled={twoFactorDisableCode.length !== 6 || disable2FAMutation.isPending}
                      >
                        {disable2FAMutation.isPending ? 'Disabling…' : 'Confirm Disable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDisable2FA(false);
                          setTwoFactorDisableCode('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                <Input
                  placeholder="Groww TOTP Token (JWT)"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Base32 TOTP Secret (from QR)"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
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
            disabled={saveRiskMutation.isPending || isProfileLoading || Boolean(profileError)}
          >
            {saveRiskMutation.isPending ? 'Saving…' : 'Save Risk Limits'}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Max Daily Loss (%)</span>
            <Input
              type="number"
              step="0.1"
              min={0.1}
              max={20}
              value={maxDailyLossPct}
              onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
              className="mt-1.5 font-mono text-sm font-semibold text-rose-400"
            />
          </label>
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Max Open Positions</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxPositions}
              onChange={(e) => setMaxPositions(Number(e.target.value))}
              className="mt-1.5 font-mono text-sm font-semibold text-white"
            />
          </label>
          <label className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 block">
            <span className="text-slate-400">Per-Trade Risk (%)</span>
            <Input
              type="number"
              step="0.1"
              min={0.1}
              max={10}
              value={perTradeRiskPct}
              onChange={(e) => setPerTradeRiskPct(Number(e.target.value))}
              className="mt-1.5 font-mono text-sm font-semibold text-sky-400"
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
