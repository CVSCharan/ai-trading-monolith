// ============================================
// AuditLogsPage (S12-004: Bot Audit Trail)
// ============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText, Search } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { SkeletonTable } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface AuditRow {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ logs: AuditRow[] }>({
    queryKey: ['audit-logs', actionFilter],
    refetchInterval: 10_000,
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '100' });
      if (actionFilter.trim()) qs.set('action', actionFilter.trim());
      return fetchJson<{ logs: AuditRow[] }>(`/api/audit?${qs.toString()}`, { credentials: 'include' });
    },
  });

  const logs = data?.logs ?? [];

  const exportCsv = () => {
    const header = ['timestamp_ist', 'action', 'entity_type', 'entity_id', 'details'];
    const rows = logs.map((r) => [
      new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      r.action,
      r.entityType ?? '',
      r.entityId ?? '',
      r.details ? JSON.stringify(r.details) : '',
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-sky-400" />
            Bot Audit Trail
          </h2>
          <p className="text-sm text-slate-400">
            Immutable log of bot commands, token syncs, risk updates, and emergency stops
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action…"
              className="pl-9 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={logs.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>{logs.length} event(s) loaded (IST)</CardDescription>
        </CardHeader>
        <CardContent>
          {error && logs.length > 0 && <QueryErrorState error={error} onRetry={() => void refetch()} title="Showing previously loaded audit events" />}
          {error && logs.length === 0 ? (
            <QueryErrorState error={error} onRetry={() => void refetch()} title="Audit events are unavailable" />
          ) : isLoading && logs.length === 0 ? (
            <SkeletonTable rows={8} cols={4} className="py-2" />
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400">No audit events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time (IST)</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.action.includes('STOP') ? 'danger' : 'info'}>
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {row.entityType ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-slate-400">
                      {row.details ? JSON.stringify(row.details) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
