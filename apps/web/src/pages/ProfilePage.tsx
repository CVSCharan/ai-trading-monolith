// ============================================
// ProfilePage (S14-004: Profile, Active Devices (Max 3) & Password)
// ============================================

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, Laptop, LogOut, ShieldCheck, Trash2, UserCircle2 } from 'lucide-react';
import { RoleGuard } from '../components/AuthGuard';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';

interface SessionItem {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function summarizeUserAgent(ua?: string | null): string {
  if (!ua) return 'Unknown Device';
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari')) return 'Safari Browser';
  if (ua.includes('curl')) return 'CLI / API Client';
  return ua.slice(0, 40);
}

export function ProfilePage() {
  const { user, isDemo, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{ variant: 'info' | 'danger' | 'success'; text: string } | null>(null);

  useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile', { credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        profile?: { displayName?: string | null; timezone?: string | null } | null;
      };
      if (data.profile?.displayName) setDisplayName(data.profile.displayName);
      if (data.profile?.timezone) setTimezone(data.profile.timezone);
      return data;
    },
  });

  const { data: sessionsData, refetch: refetchSessions } = useQuery<{
    maxSessions: number;
    sessions: SessionItem[];
  }>({
    queryKey: ['auth-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/auth/sessions', { credentials: 'include' });
      if (!res.ok) return { maxSessions: 3, sessions: [] };
      return res.json();
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, timezone }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to update profile');
      return json;
    },
    onSuccess: () => setFeedback({ variant: 'success', text: 'Profile updated.' }),
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/auth/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to revoke session');
      return res.json();
    },
    onSuccess: () => {
      setFeedback({ variant: 'info', text: 'Device session revoked.' });
      void refetchSessions();
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to log out all devices');
      return res.json();
    },
    onSuccess: async () => {
      await logout();
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.');
      }
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to update password');
      return json;
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ variant: 'success', text: 'Password updated successfully.' });
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const sessions = sessionsData?.sessions ?? [];
  const maxSessions = sessionsData?.maxSessions ?? 3;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <UserCircle2 className="h-6 w-6 text-sky-400" />
            Profile &amp; Session Security
          </h2>
          <p className="text-sm text-slate-400">
            Account details, active devices (max {maxSessions} concurrent), and password rotation
          </p>
        </div>
        <Badge variant={isDemo ? 'warning' : 'success'}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {user?.role ?? 'SUPER_ADMIN'}
        </Badge>
      </div>

      {feedback && <Alert variant={feedback.variant}>{feedback.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <RoleGuard role="SUPER_ADMIN" message="Demo account profile is read-only.">
          <Card>
            <CardHeader>
              <CardTitle>Operator Profile</CardTitle>
              <CardDescription>Signed in as {user?.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-xs text-slate-400">
                Display Name
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Timezone
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1.5 font-mono"
                />
              </label>
              <Button
                variant="primary"
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending || !displayName}
              >
                {saveProfileMutation.isPending ? 'Saving…' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </RoleGuard>

        <RoleGuard role="SUPER_ADMIN" message="Password changes are disabled for the demo account.">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                Change Password
              </CardTitle>
              <CardDescription>Minimum 8 characters · Verified against current scrypt hash</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending || !currentPassword || newPassword.length < 8}
              >
                {changePasswordMutation.isPending ? 'Updating…' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        </RoleGuard>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-emerald-400" />
              Active Devices ({sessions.length} / {maxSessions} max)
            </CardTitle>
            <CardDescription>
              Logging in on a 4th device automatically revokes the oldest session
            </CardDescription>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => logoutAllMutation.mutate()}
            disabled={logoutAllMutation.isPending}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out All Devices
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400">No active sessions found.</p>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{summarizeUserAgent(s.userAgent)}</span>
                      {s.isCurrent && <Badge variant="success">Current Device</Badge>}
                    </div>
                    <div className="font-mono text-slate-400">
                      IP: {s.ipAddress ?? '—'} · Expires: {new Date(s.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeSessionMutation.mutate(s.id)}
                      disabled={revokeSessionMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
