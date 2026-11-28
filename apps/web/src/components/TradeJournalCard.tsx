import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, CheckCircle2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { fetchJson } from '../lib/api';

interface JournalEntry {
  tradeId: string;
  tradeSource: 'BACKTEST' | 'PAPER' | 'LIVE';
  setupTag: string;
  emotionTag: string;
  followedRules: boolean;
  rating: number;
  notes: string;
}

export function TradeJournalCard({
  tradeId,
  tradeSource = 'BACKTEST',
}: {
  tradeId: string;
  tradeSource?: 'BACKTEST' | 'PAPER' | 'LIVE';
}) {
  const qc = useQueryClient();
  const [setupTag, setSetupTag] = useState('9_21_EMA');
  const [emotionTag, setEmotionTag] = useState('CALM');
  const [followedRules, setFollowedRules] = useState(true);
  const [rating, setRating] = useState(4);
  const [notes, setNotes] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const { data } = useQuery<{ entry: JournalEntry | null }>({
    queryKey: ['trade-journal', tradeId],
    enabled: Boolean(tradeId),
    queryFn: () =>
      fetchJson<{ entry: JournalEntry | null }>(`/api/journal/${encodeURIComponent(tradeId)}`, {
        credentials: 'include',
      }),
  });

  useEffect(() => {
    if (data?.entry) {
      setSetupTag(data.entry.setupTag);
      setEmotionTag(data.entry.emotionTag);
      setFollowedRules(data.entry.followedRules);
      setRating(data.entry.rating);
      setNotes(data.entry.notes);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/journal/${encodeURIComponent(tradeId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tradeSource,
          setupTag,
          emotionTag,
          followedRules,
          rating,
          notes,
        }),
      }),
    onSuccess: () => {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      void qc.invalidateQueries({ queryKey: ['trade-journal', tradeId] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <BookMarked className="h-4 w-4 text-amber-400" />
            Trader Post-Trade Journal
          </CardTitle>
          {savedNotice && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </Badge>
          )}
        </div>
        <CardDescription>
          Record setup quality, mindset, and rule adherence to eliminate emotional leaks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-slate-400">
            Setup Tag
            <Select value={setupTag} onChange={(e) => setSetupTag(e.target.value)} className="mt-1">
              <option value="9_21_EMA">9/21 EMA Crossover</option>
              <option value="ORB_BREAKOUT">ORB Breakout</option>
              <option value="VWAP_PULLBACK">VWAP Pullback</option>
              <option value="RSI_MEAN_REVERSION">RSI Mean Reversion</option>
              <option value="DISCRETIONARY">Discretionary</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Mindset / Emotion
            <Select value={emotionTag} onChange={(e) => setEmotionTag(e.target.value)} className="mt-1">
              <option value="CALM">Calm &amp; Systematic</option>
              <option value="FOMO">FOMO Entry</option>
              <option value="HESITANT">Hesitant / Late</option>
              <option value="REVENGE">Revenge Trade</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Followed Rules?
            <Select
              value={followedRules ? 'yes' : 'no'}
              onChange={(e) => setFollowedRules(e.target.value === 'yes')}
              className="mt-1"
            >
              <option value="yes">Yes — Followed Plan</option>
              <option value="no">No — Rule Violation</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Execution Rating (1–5)
            <Select value={String(rating)} onChange={(e) => setRating(Number(e.target.value))} className="mt-1">
              <option value="5">5 — Textbook</option>
              <option value="4">4 — Solid</option>
              <option value="3">3 — Average</option>
              <option value="2">2 — Sloppy</option>
              <option value="1">1 — Avoidable Mistake</option>
            </Select>
          </label>
        </div>

        <label className="block text-xs text-slate-400">
          Notes &amp; Lessons Learned
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was the market regime? Did you respect stop-loss and entry window?"
            className="mt-1"
          />
        </label>

        <Button
          variant="primary"
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving Journal…' : 'Save Journal Entry'}
        </Button>
      </CardContent>
    </Card>
  );
}
